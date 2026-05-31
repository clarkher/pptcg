import { Router } from 'express';
import { searchYugioh, searchPokemon } from '../controllers/cards';

const router = Router();
router.get('/yugioh', searchYugioh);
router.get('/pokemon', searchPokemon);
export default router;
