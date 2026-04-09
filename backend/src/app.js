require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const pool = require('./config/database');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/responsables', require('./routes/responsables'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/tarifas', require('./routes/tarifas'));
app.use('/api/presupuestos', require('./routes/presupuestos'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Cron: cada noche a las 00:05 — presupuestos APROBADOS con fecha_fin pasada → PENDIENTE_FACTURAR
cron.schedule('5 0 * * *', async () => {
  try {
    const result = await pool.query(`
      UPDATE presupuestos
      SET status = 'PENDIENTE_FACTURAR', updated_at = NOW()
      WHERE status = 'APROBADO'
        AND fecha_fin IS NOT NULL
        AND fecha_fin < CURRENT_DATE
    `);
    if (result.rowCount > 0) {
      console.log(`[CRON] ${result.rowCount} presupuestos → PENDIENTE_FACTURAR`);
    }
  } catch (err) {
    console.error('[CRON] Error al actualizar estados:', err.message);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

module.exports = app;
