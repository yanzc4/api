const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/api/dni', async (req, res) => {
    const { dni } = req.query;

    if (!dni) {
        return res.status(400).json({ error: 'DNI is required' });
    }

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process'
            ],
            timeout: 0
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

app.get('/test', async (req, res) => {
    try {
        const page = await browser.newPage();
        await page.goto('https://example.com');
        const title = await page.title();
        res.send(title);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
