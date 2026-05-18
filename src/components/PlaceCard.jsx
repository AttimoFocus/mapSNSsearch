import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MapPin, Sparkles, Loader2, Target, ThumbsUp, AlertTriangle, Lightbulb, Store, Instagram, Smartphone, Video, Bookmark } from 'lucide-react';

const PlaceCard = ({ place, isSelected, onClick, analysisResult, isAnalyzing, onAnalyzeClick, onSave, isSaved }) => {
  const handleAnalyze = async (e) => {
    e.stopPropagation();
    if ((analysisResult && !analysisResult.error) || isAnalyzing) return;
    onAnalyzeClick(place);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-100';
    if (score >= 50) return 'text-amber-500 bg-amber-100';
    return 'text-rose-500 bg-rose-100';
  };

  return (
    <div 
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500/20' 
          : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2">{place.name}</h3>
        
        <div className="flex items-center text-sm text-slate-500 mb-1">
          <MapPin className="w-4 h-4 mr-1 text-slate-400" />
          <span className="truncate">{place.formatted_address || place.vicinity}</span>
        </div>
        
        <div className="flex items-center gap-4 text-sm mt-3">
          {place.rating && (
            <div className="flex items-center text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
              <Star className="w-4 h-4 fill-amber-500 mr-1" />
              {place.rating} <span className="text-slate-400 ml-1 text-xs">({place.user_ratings_total})</span>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="ml-auto flex items-center gap-2">
            {analysisResult && !analysisResult.error && onSave && (
              <button
                onClick={(e) => { e.stopPropagation(); onSave(); }}
                className={`p-1.5 rounded-full transition-all ${
                  isSaved 
                    ? 'text-white bg-blue-600 shadow-sm' 
                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                }`}
                title={isSaved ? "保存済み" : "お気に入り保存"}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            )}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                analysisResult && !analysisResult.error
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                  : analysisResult?.error
                  ? 'bg-rose-500 text-white shadow-md hover:bg-rose-600'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
              }`}
            >
              {isAnalyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : analysisResult && !analysisResult.error ? (
                <Target className="w-3.5 h-3.5" />
              ) : analysisResult?.error ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isAnalyzing ? '分析中...' : analysisResult && !analysisResult.error ? '分析済' : analysisResult?.error ? '再試行' : 'AIターゲット分析'}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results Expansion */}
      <AnimatePresence>
        {analysisResult?.error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-rose-100 bg-rose-50 overflow-hidden"
          >
            <div className="p-3 text-xs text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p>{analysisResult.message}</p>
            </div>
          </motion.div>
        )}

        {analysisResult && !analysisResult.error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-blue-100 bg-gradient-to-b from-blue-50/50 to-white overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Score and Summary */}
              <div className="flex items-start gap-3">
                <div className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] rounded-xl font-black text-2xl ${getScoreColor(analysisResult.score)}`}>
                  {analysisResult.score}
                  <span className="text-[10px] font-medium opacity-80 -mt-1">SCORE</span>
                </div>
                <p className="text-sm text-slate-700 font-medium leading-relaxed pt-1">
                  {analysisResult.summary}
                </p>
              </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold mb-3">
                    <Store className="w-4 h-4 text-blue-500" /> 店舗形態: {analysisResult.businessType}
                  </div>
                  
                  <div className="space-y-3">
                    {/* Instagram */}
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-pink-100 text-pink-600 rounded-lg"><Instagram className="w-4 h-4" /></div>
                        <span className="font-bold text-slate-700">Instagram</span>
                      </div>
                      {analysisResult.sns?.instagram?.exists ? (
                        <div className="text-right">
                          <p className="text-slate-600">👤 {analysisResult.sns.instagram.followers}</p>
                          <p className="text-slate-500">🔄 {analysisResult.sns.instagram.update}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded">未確認 / なし</span>
                      )}
                    </div>

                    {/* TikTok */}
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-black text-white rounded-lg"><Video className="w-4 h-4" /></div>
                        <span className="font-bold text-slate-700">TikTok</span>
                      </div>
                      {analysisResult.sns?.tiktok?.exists ? (
                        <div className="text-right">
                          <p className="text-slate-600">👤 {analysisResult.sns.tiktok.followers}</p>
                          <p className="text-slate-500">🔄 {analysisResult.sns.tiktok.update}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded">未確認 / なし</span>
                      )}
                    </div>

                    {/* Threads */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-800 text-white rounded-lg"><Smartphone className="w-4 h-4" /></div>
                        <span className="font-bold text-slate-700">Threads</span>
                      </div>
                      {analysisResult.sns?.threads?.exists ? (
                        <div className="text-right">
                          <p className="text-slate-600">👤 {analysisResult.sns.threads.followers}</p>
                          <p className="text-slate-500">🔄 {analysisResult.sns.threads.update}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 bg-slate-100 px-2 py-1 rounded">未確認 / なし</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-2">
                    <ThumbsUp className="w-4 h-4" /> ターゲットとしての強み
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-1">
                    {analysisResult.strengths?.map((s, i) => <li key={i} className="text-xs">{s}</li>)}
                  </ul>
                </div>

                <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                  <div className="flex items-center gap-1.5 text-rose-700 font-bold mb-2">
                    <AlertTriangle className="w-4 h-4" /> 課題・懸念点
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-1">
                    {analysisResult.weaknesses?.map((w, i) => <li key={i} className="text-xs">{w}</li>)}
                  </ul>
                </div>

                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold mb-2">
                    <Lightbulb className="w-4 h-4" /> 営業アプローチ提案
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {analysisResult.salesApproach}
                  </p>
                </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlaceCard;
