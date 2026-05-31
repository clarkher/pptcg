import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT || '3001');

app.listen(PORT, () => {
  console.log(`🃏 PPTCG API running on http://localhost:${PORT}`);
});
