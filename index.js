const express = require('express');
const puppeteer = require('puppeteer');
const app = express(); 
const port = 3000;

let browser;

(async () => {
    browser = await puppeteer.launch({
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

    console.log("✅ Browser iniciado");
})();

app.use(express.json());

app.get('/api/dni', async (req, res) => {
    const { dni } = req.query;

    if (!dni) {
        return res.status(400).json({ error: 'DNI is required' });
    }

    try {
        const page = await browser.newPage();

        // Navegar a la página
        await page.goto('https://eldni.com/pe/buscar-datos-por-dni');

        // Cerrar el modal si aparece
        await page.waitForSelector('#dni');
        await page.type('#dni', dni);

        // Haz clic en el botón de búsqueda
        await Promise.all([
            page.click('#btn-buscar-datos-por-dni'),
            page.waitForNavigation({ waitUntil: 'networkidle0' }) // Espera a que la navegación termine
        ]);
        // Extrae los datos deseados
        const nombres = await page.$eval('#nombres', el => el.textContent.trim());
        const apellidoPaterno = await page.$eval('#apellidop', el => el.textContent.trim());
        const apellidoMaterno = await page.$eval('#apellidom', el => el.textContent.trim());

        await page.close();

        const datos = {
            nombres,
            apellidoPaterno,
            apellidoMaterno
        };

        // Retornar los resultados
        res.json(datos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al realizar el scraping', details: error.message });
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
