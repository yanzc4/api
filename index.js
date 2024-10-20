const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const port = 3000;

app.use(express.json());

app.post('/extract-code', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Por favor, proporciona una URL en el cuerpo de la solicitud.' });
    }

    try {
        // Inicia el navegador
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Navegar a la página proporcionada
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Espera a que el contenedor 'ace_text-layer' esté presente
        await page.waitForSelector('.ace_text-layer');

        // Ejecuta el scroll y selecciona el contenido
        const textContent = await page.evaluate(async () => {
            const aceTextLayer = document.querySelector('.ace_text-layer');
            const aceScrollBar = document.querySelector('.ace_scrollbar');
            if (!aceTextLayer || !aceScrollBar) return 'No se encontró el editor o la barra de desplazamiento';

            let codeText = '';
            const lineHeight = 21; // Altura de desplazamiento
            const maxScrollTop = aceScrollBar.scrollHeight - aceScrollBar.clientHeight; // Máximo desplazamiento permitido

            // Comenzar el desplazamiento
            for (let scrollTop = 0; scrollTop <= maxScrollTop; scrollTop += lineHeight) {
                // Establecer el desplazamiento en la barra de desplazamiento
                aceScrollBar.scrollTop = scrollTop;

                // Espera para permitir que el contenido se renderice
                await new Promise(resolve => setTimeout(resolve, 200)); // Ajusta el tiempo si es necesario

                // Selecciona todas las líneas visibles
                const visibleLines = Array.from(aceTextLayer.querySelectorAll('.ace_line'))
                    .filter(line => {
                        const lineTop = parseInt(line.style.top);
                        return lineTop >= scrollTop && lineTop < scrollTop + lineHeight;
                    });

                // Si hay líneas visibles, agrega la última línea a codeText
                if (visibleLines.length > 0) {
                    const lastVisibleLineText = visibleLines[visibleLines.length - 1].innerText.trim();
                    codeText += lastVisibleLineText + '\n'; // Agrega la última línea visible al código
                }
            }

            // Espera un último momento para asegurarte de que todo el contenido se haya cargado
            await new Promise(resolve => setTimeout(resolve, 200));

            // Extrae el texto restante después del scroll
            const remainingCode = Array.from(aceTextLayer.querySelectorAll('.ace_line'))
                .map(line => line.textContent.trim())
                .join('\n');

            return codeText + remainingCode.trim();
        });

        // Cierra el navegador
        await browser.close();

        // Envía el contenido copiado como respuesta
        res.json({ content: textContent });
    } catch (error) {
        res.status(500).json({ error: 'Error al extraer el contenido.', details: error.message });
    }
});

app.get('/api/dni', async (req, res) => {
    const { dni } = req.query;

    if (!dni) {
        return res.status(400).json({ error: 'DNI is required' });
    }

    try {
        const browser = await puppeteer.launch({
            headless: false, 
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Navegar a la página
        await page.goto('https://mpv.cofopri.gob.pe/Management/FrmMesaPartesVirtual.aspx', {
            waitUntil: 'networkidle2',
            timeout: 10000
        });

        // Cerrar el modal si aparece
        await page.waitForSelector('#ModalAviso', { timeout: 5000 }).catch(() => {
            console.log("No se encontró el modal.");
        });
        
        await page.evaluate(() => {
            const modal = document.querySelector('#ModalAviso');
            if (modal) {
                $(modal).modal('hide');
            }
        });

        // Escribir el DNI en el campo de entrada
        await page.waitForSelector('#ContentPlaceHolder1_TxtNroDNI', { timeout: 5000 });
        await page.type('#ContentPlaceHolder1_TxtNroDNI', dni);

        // Hacer clic en el botón de búsqueda
        await page.click('#imgBtnSearchDni');

        // Esperar a que el valor de apellido materno esté lleno
        await page.waitForFunction(() => {
            const apellidoMaternoField = document.querySelector('#ContentPlaceHolder1_TxtApeMaterno');
            return apellidoMaternoField && apellidoMaternoField.value.trim() !== '';
        }, { timeout: 10000 });

        // Extraer los resultados
        const datos = await page.evaluate(() => {
            const nombres = document.querySelector('#ContentPlaceHolder1_TxtNombres')?.value.trim() || '';
            const apellidoPaterno = document.querySelector('#ContentPlaceHolder1_TxtApePaterno')?.value.trim() || '';
            const apellidoMaterno = document.querySelector('#ContentPlaceHolder1_TxtApeMaterno')?.value.trim() || '';
            return { nombres, apellidoPaterno, apellidoMaterno };
        });

        await browser.close();

        // Retornar los resultados
        res.json(datos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al realizar el scraping' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
