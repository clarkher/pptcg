import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardsApi } from '../api/cards';
import { listingsApi } from '../api/listings';
import { uploadImage } from '../api/upload';
import type { Card, Condition } from '../types';
import { Header } from '../components/Header';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

type Step = 'select-game' | 'search-card' | 'fill-details';
const CONDITIONS: Condition[] = ['NM', 'LP', 'MP', 'HP'];
const CONDITION_DESC: Record<Condition, string> = {
  NM: '近全新',
  LP: '輕微磨損',
  MP: '中度磨損',
  HP: '重度磨損',
};

export function Sell() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('select-game');
  const [game, setGame] = useState<'yugioh' | 'pokemon'>('yugioh');
  const [searchQuery, setSearchQuery] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [searching, setSearching] = useState(false);
  const [condition, setCondition] = useState<Condition>('NM');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customImage, setCustomImage] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomImage = (file: File) => {
    setCustomImage(file);
    setCustomImagePreview(URL.createObjectURL(file));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = game === 'yugioh'
        ? await cardsApi.searchYugioh(searchQuery)
        : await cardsApi.searchPokemon(searchQuery);
      setCards(results);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !price) return;
    setSubmitting(true);
    setError('');
    try {
      let cardImage = selectedCard.image || '';
      if (customImage) {
        cardImage = await uploadImage(customImage);
      }
      await listingsApi.create({
        cardId: selectedCard.id,
        cardName: selectedCard.name,
        cardGame: selectedCard.game,
        cardImage,
        condition,
        price: parseFloat(price),
        quantity: parseInt(quantity) || 1,
        description: description || undefined,
      });
      navigate('/profile');
    } catch (err: any) {
      setError(err.response?.data?.error || '上架失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-24">
      <Header
        title="上架商品"
        right={
          step !== 'select-game' ? (
            <button
              onClick={() => setStep(step === 'fill-details' ? 'search-card' : 'select-game')}
              className="text-sm text-slate-400"
            >
              ← 返回
            </button>
          ) : undefined
        }
      />

      <div className="px-4 pt-4">
        {/* Step 1: Select Game */}
        {step === 'select-game' && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">選擇要上架的遊戲</p>
            <button
              onClick={() => { setGame('yugioh'); setStep('search-card'); }}
              className="w-full bg-[#16213E] border border-yellow-500/30 hover:border-yellow-500/60 rounded-2xl p-5 flex items-center gap-4 transition-colors"
            >
              <span className="text-3xl">⚔️</span>
              <div className="text-left">
                <p className="font-bold text-yellow-400">遊戲王</p>
                <p className="text-xs text-slate-400">OCG / TCG 卡牌</p>
              </div>
            </button>
            <button
              onClick={() => { setGame('pokemon'); setStep('search-card'); }}
              className="w-full bg-[#16213E] border border-red-500/30 hover:border-red-500/60 rounded-2xl p-5 flex items-center gap-4 transition-colors"
            >
              <span className="text-3xl">⚡</span>
              <div className="text-left">
                <p className="font-bold text-red-400">寶可夢</p>
                <p className="text-xs text-slate-400">Pokemon TCG 卡牌</p>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Search Card */}
        {step === 'search-card' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <GameBadge game={game} size="md" />
              <p className="text-slate-400 text-sm">搜尋卡牌</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={game === 'yugioh' ? '輸入卡牌名稱...' : '輸入寶可夢名稱...'}
                className="flex-1 bg-[#16213E] border border-[#0F3460] rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-violet-500 text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-violet-600 text-white px-4 py-3 rounded-xl font-medium text-sm"
              >
                搜尋
              </button>
            </div>

            {searching ? (
              <LoadingSpinner text="搜尋中..." />
            ) : (
              <div className="space-y-2">
                {cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => { setSelectedCard(card); setStep('fill-details'); }}
                    className="w-full bg-[#16213E] border border-[#0F3460] rounded-xl p-3 flex items-center gap-3 hover:border-violet-500/50 transition-colors"
                  >
                    {card.image && (
                      <img src={card.image} alt={card.name} className="w-12 h-12 object-contain rounded" />
                    )}
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-slate-100">{card.name}</p>
                      <p className="text-xs text-slate-500">{card.type}</p>
                    </div>
                    <span className="text-slate-500">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Fill details */}
        {step === 'fill-details' && selectedCard && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selected card preview */}
            <div className="bg-[#16213E] border border-[#0F3460] rounded-xl p-3 flex items-center gap-3">
              {selectedCard.image && (
                <img src={selectedCard.image} alt={selectedCard.name} className="w-14 h-14 object-contain rounded" />
              )}
              <div>
                <p className="font-medium text-slate-100">{selectedCard.name}</p>
                <GameBadge game={selectedCard.game} />
              </div>
            </div>

            {/* Custom photo upload */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">上傳實物照片（可選）</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCustomImage(f); }}
              />
              {customImagePreview ? (
                <div className="relative inline-block">
                  <img src={customImagePreview} className="h-24 rounded-xl object-contain bg-[#16213E]" />
                  <button
                    type="button"
                    onClick={() => { setCustomImage(null); setCustomImagePreview(''); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                  >✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-[#0F3460] hover:border-violet-500/50 rounded-xl py-4 text-slate-500 text-sm transition-colors"
                >
                  📷 點此上傳照片
                </button>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Condition */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">卡牌狀態</label>
              <div className="grid grid-cols-4 gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c)}
                    className={`py-2 rounded-xl text-sm font-bold transition-colors ${
                      condition === c
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#16213E] text-slate-400 border border-[#0F3460]'
                    }`}
                  >
                    <div>{c}</div>
                    <div className="text-xs font-normal opacity-70">{CONDITION_DESC[c]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">售價 (NT$)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#16213E] border border-[#0F3460] rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-violet-500 text-sm"
                placeholder="0"
                min="1"
                required
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">數量</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#16213E] border border-[#0F3460] rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-violet-500 text-sm"
                min="1"
                max="99"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">補充說明（可選）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#16213E] border border-[#0F3460] rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-violet-500 text-sm resize-none"
                placeholder="描述卡牌的額外資訊..."
                rows={3}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {submitting ? '上架中...' : '確認上架'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
