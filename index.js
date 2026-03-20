const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

let browser;

// 🚀 Inicializar browser correctamente
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
        // 🛑 Esperar a que el browser esté listo
        if (!browser) {
            return res.status(503).json({ error: 'Browser no listo, intenta nuevamente' });
        }

        const page = await browser.newPage();

        // 🚀 Optimización: bloquear recursos pesados
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['image', 'stylesheet', 'font'].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // 🧠 Simular navegador real
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
        );

        console.log("🌐 Cargando página...");

        await page.goto('https://mpv.cofopri.gob.pe/Management/FrmMesaPartesVirtual.aspx', {
            waitUntil: 'domcontentloaded',
            timeout: 0
        });

        // 🧹 eliminar modal sin jQuery (más estable)
        await page.evaluate(() => {
            const modal = document.querySelector('#ModalAviso');
            if (modal) modal.remove();
        });

        console.log("⌨️ Escribiendo DNI...");

        await page.waitForSelector('#ContentPlaceHolder1_TxtNroDNI', { timeout: 15000 });
        await page.type('#ContentPlaceHolder1_TxtNroDNI', dni, { delay: 50 });

        await page.click('#imgBtnSearchDni');

        console.log("⏳ Esperando respuesta...");

        await page.waitForFunction(() => {
            const el = document.querySelector('#ContentPlaceHolder1_TxtApeMaterno');
            return el && el.value && el.value.trim() !== '';
        }, { timeout: 20000 });

        const datos = await page.evaluate(() => ({
            nombres: document.querySelector('#ContentPlaceHolder1_TxtNombres')?.value || '',
            apellidoPaterno: document.querySelector('#ContentPlaceHolder1_TxtApePaterno')?.value || '',
            apellidoMaterno: document.querySelector('#ContentPlaceHolder1_TxtApeMaterno')?.value || ''
        }));

        await page.close();

        res.json({
            success: true,
            data: datos
        });

    } catch (error) {
        console.error("❌ ERROR:", error);

        res.status(500).json({
            error: 'Error al realizar el scraping',
            details: error.message
        });
    }
});

// 🧪 endpoint de prueba
app.get('/test', async (req, res) => {
    try {
        if (!browser) return res.send("Browser aún iniciando...");

        const page = await browser.newPage();
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        await page.close();

        res.send(title);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor en http://localhost:${port}`);
});