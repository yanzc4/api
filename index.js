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
    const { dni } = req.query; // Se espera que el DNI venga en el cuerpo de la solicitud

    if (!dni) {
        return res.status(400).json({ error: 'DNI is required' });
    }

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }); // Cambia a false si deseas ver el navegador
        const page = await browser.newPage();

        // Navega a la página del formulario
        await page.goto('https://eldni.com/pe/buscar-por-dni');

        // Espera a que el input de DNI esté visible
        await page.waitForSelector('#dni');

        // Escribe el DNI en el campo de entrada
        await page.type('#dni', dni);

        // Haz clic en el botón de búsqueda
        await Promise.all([
            page.click('#btn-buscar-por-dni'),
            page.waitForNavigation({ waitUntil: 'networkidle0' }) // Espera a que la navegación termine
        ]);
        // Espera a que el contenido se cargue
        await page.waitForSelector('#nombres');
        await page.waitForSelector('#apellidop');
        await page.waitForSelector('#apellidom');

        // Extrae los datos deseados
        const nombres = await page.$eval('#nombres', el => el.value.trim());
        const apellidoPaterno = await page.$eval('#apellidop', el => el.value.trim());
        const apellidoMaterno = await page.$eval('#apellidom', el => el.value.trim());

        await browser.close();

        // Devuelve los datos extraídos
        res.json({
            nombres,
            apellidoPaterno,
            apellidoMaterno
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to scrape data' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
