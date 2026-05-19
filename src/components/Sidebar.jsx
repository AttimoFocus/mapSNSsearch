import React, { useState, useEffect } from 'react';
import { Search, Loader2, Filter, Zap, Bookmark, List } from 'lucide-react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import PlaceCard from './PlaceCard';
import SavedPlaceCard from './SavedPlaceCard';

const Sidebar = ({ places, selectedPlace, setSelectedPlace, searchQuery, setSearchQuery, isSearching, analysisResults, setAnalysisResults, analyzingPlaceId, setAnalyzingPlaceId, filterType, setFilterType, isBatchAnalyzing, setIsBatchAnalyzing }) => {
  const map = useMap();
  const placesLibrary = useMapsLibrary('places');
  const [placesService, setPlacesService] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [savedPlaceIds, setSavedPlaceIds] = useState(new Set());
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  useEffect(() => {
    if (!placesLibrary || !map) return;
    setPlacesService(new placesLibrary.PlacesService(map));
  }, [placesLibrary, map]);

  const fetchSavedPlaces = async () => {
    setIsLoadingSaved(true);
    try {
      const res = await fetch('/api/saved_places');
      if (res.ok) {
        const data = await res.json();
        setSavedPlaces(data);
        setSavedPlaceIds(new Set(data.map(p => p.place_id)));
      }
    } catch (e) {
      console.error("Failed to fetch saved places", e);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchSavedPlaces();
  }, []);

  useEffect(() => {
    if (activeTab === 'saved') {
      fetchSavedPlaces();
    }
  }, [activeTab]);

  const handleSavePlace = async (place) => {
    const analysis = analysisResults[place.place_id] && !analysisResults[place.place_id].error 
      ? analysisResults[place.place_id] 
      : null;
      
    try {
      const response = await fetch('/api/saved_places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address || place.vicinity,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total,
          website: place.website || place.url,
          analysis,
          status: '未対応'
        })
      });
      if (response.ok) {
        setSavedPlaceIds(prev => new Set([...prev, place.place_id]));
        fetchSavedPlaces(); // 保存リストの中身も最新にする
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`保存に失敗しました: ${errorData.error || 'サーバー側のエラーが発生しました。'}`);
      }
    } catch (e) {
      console.error("Failed to save", e);
      alert("保存中に通信エラーが発生しました。");
    }
  };

  const handleUpdateStatus = async (place_id, status) => {
    try {
      await fetch('/api/saved_places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id, status })
      });
      setSavedPlaces(prev => prev.map(p => p.place_id === place_id ? { ...p, status } : p));
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const handleDeleteSaved = async (place_id) => {
    if (!confirm('保存リストから削除しますか？')) return;
    try {
      await fetch(`/api/saved_places/${place_id}`, { method: 'DELETE' });
      setSavedPlaces(prev => prev.filter(p => p.place_id !== place_id));
      setSavedPlaceIds(prev => {
        const next = new Set(prev);
        next.delete(place_id);
        return next;
      });
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleToggleSave = async (place) => {
    const isCurrentlySaved = savedPlaceIds.has(place.place_id);
    if (isCurrentlySaved) {
      try {
        await fetch(`/api/saved_places/${place.place_id}`, { method: 'DELETE' });
        setSavedPlaces(prev => prev.filter(p => p.place_id !== place.place_id));
        setSavedPlaceIds(prev => {
          const next = new Set(prev);
          next.delete(place.place_id);
          return next;
        });
      } catch (e) {
        console.error("Failed to delete", e);
      }
    } else {
      await handleSavePlace(place);
    }
  };

  const handleAnalyze = async (place) => {
    const existingResult = analysisResults[place.place_id];
    if ((existingResult && !existingResult.error) || analyzingPlaceId === place.place_id) return;
    
    setAnalyzingPlaceId(place.place_id);
    try {
      let placeToSend = place;
      if (placesService) {
        placeToSend = await new Promise((resolve) => {
          placesService.getDetails({
            placeId: place.place_id,
            fields: ['name', 'formatted_address', 'rating', 'user_ratings_total', 'types', 'website', 'formatted_phone_number', 'url']
          }, (result, status) => {
            if (status === placesLibrary.PlacesServiceStatus.OK && result) {
              resolve({ ...place, ...result });
            } else {
              resolve(place);
            }
          });
        });
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place: placeToSend })
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysisResults(prev => ({ ...prev, [place.place_id]: data.analysis }));
        // すでに保存リストに入っている場合のみ、データベースのレコードを最新の解析結果で更新する
        if (savedPlaceIds.has(place.place_id)) {
          await handleSavePlace({ ...placeToSend, analysis: data.analysis });
        }
      } else {
        setAnalysisResults(prev => ({ ...prev, [place.place_id]: { error: true, message: 'AIが混み合っているため分析できませんでした。後ほど再度お試しください。' } }));
      }
    } catch (err) {
      console.error("Failed to analyze:", err);
      setAnalysisResults(prev => ({ ...prev, [place.place_id]: { error: true, message: '通信エラーが発生しました。' } }));
    } finally {
      setAnalyzingPlaceId(null);
    }
  };

  const isBatchAnalyzingRef = React.useRef(isBatchAnalyzing);
  
  React.useEffect(() => {
    isBatchAnalyzingRef.current = isBatchAnalyzing;
  }, [isBatchAnalyzing]);

  const handleBatchAnalyze = async () => {
    if (isBatchAnalyzing) return;
    setIsBatchAnalyzing(true);
    isBatchAnalyzingRef.current = true; // Synchronously set to true to prevent state propagation lag from breaking the loop on first iteration
    
    const unanalyzedPlaces = places.filter(p => !analysisResults[p.place_id]);
    
    for (const place of unanalyzedPlaces) {
      if (!isBatchAnalyzingRef.current) break; // 中止されたらループを抜ける
      
      await handleAnalyze(place);
      
      if (!isBatchAnalyzingRef.current) break; // 分析後にもう一度チェック
      
      // Wait 5 seconds to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    setIsBatchAnalyzing(false);
    isBatchAnalyzingRef.current = false;
  };

  const filteredPlaces = places.filter(place => {
    const res = analysisResults[place.place_id];
    if (filterType === 'all') return true;
    if (filterType === 'analyzed') return !!res;
    if (!res) return false;
    
    if (filterType === 'personal') return res.businessType === '個人経営';
    if (filterType === 'instagram') return res.sns?.instagram?.exists;
    if (filterType === 'tiktok') return res.sns?.tiktok?.exists;
    if (filterType === 'high_score') return res.score >= 80;
    
    return true;
  });

  const handleDownloadCSV = () => {
    if (places.length === 0) return;

    // CSV Header
    const headers = ['店舗名', '住所', '評価', 'レビュー数', 'スコア', '経営形態', 'Instagram', 'TikTok', 'Threads', '強み', '弱み', '営業アプローチ', 'Webサイト'];
    
    // CSV Rows
    const rows = places.map(place => {
      const res = analysisResults[place.place_id] || {};
      const isError = res.error === true;
      const escape = (text) => `"${String(text || '').replace(/"/g, '""')}"`;
      
      return [
        escape(place.name),
        escape(place.formatted_address || place.vicinity),
        place.rating || '',
        place.user_ratings_total || 0,
        isError ? 'エラー' : (res.score || '未分析'),
        isError ? '' : escape(res.businessType),
        isError ? '' : (res.sns?.instagram?.exists ? escape(res.sns.instagram.followers) : (res.score ? 'なし' : '未分析')),
        isError ? '' : (res.sns?.tiktok?.exists ? escape(res.sns.tiktok.followers) : (res.score ? 'なし' : '未分析')),
        isError ? '' : (res.sns?.threads?.exists ? escape(res.sns.threads.followers) : (res.score ? 'なし' : '未分析')),
        isError ? '' : escape((res.strengths || []).join(' / ')),
        isError ? '' : escape((res.weaknesses || []).join(' / ')),
        isError ? '' : escape(res.salesApproach),
        escape(place.website || place.url || '') // URL or Google Maps URL
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TargetList_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full bg-white border-r border-slate-200 shadow-xl flex flex-col z-20">
      
      {/* Header / Tabs */}
      <div className="p-6 bg-slate-900 text-white flex-shrink-0 relative">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="text-blue-400">Target</span>Search
        </h2>

        <div className="flex bg-slate-800 p-1 rounded-xl mb-4">
          <button 
            onClick={() => setActiveTab('search')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'search' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <Search className="w-4 h-4" /> 検索
          </button>
          <button 
            onClick={() => setActiveTab('saved')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'saved' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <Bookmark className="w-4 h-4" /> 保存リスト
          </button>
        </div>

        {activeTab === 'search' && (
          <>
            <button
              onClick={handleDownloadCSV}
              disabled={places.length === 0}
              className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg text-xs font-bold transition-all text-slate-300 hover:text-white"
              title="リストをCSVでダウンロード"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              CSV出力
            </button>

            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="例: 福岡市 美容室"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">すべて表示</option>
                  <option value="analyzed">分析済みのみ</option>
                  <option value="personal">個人経営のみ</option>
                  <option value="high_score">スコア80点以上</option>
                  <option value="instagram">Instagramあり</option>
                  <option value="tiktok">TikTokあり</option>
                </select>
                <Filter className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              </div>
              
              <button
                onClick={handleBatchAnalyze}
                disabled={isBatchAnalyzing || places.length === 0}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  isBatchAnalyzing
                    ? 'bg-blue-900 text-blue-300 cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isBatchAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {isBatchAnalyzing ? '一括分析中...' : '未分析を一括AI分析'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {activeTab === 'search' ? (
          <>
            {isSearching && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>検索中...</p>
              </div>
            )}

            {!isSearching && places.length > 0 && filteredPlaces.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                <p>条件に一致する店舗がありません。</p>
                {filterType !== 'all' && <p className="mt-1 text-xs">※AI分析が完了していない店舗は除外されます。</p>}
              </div>
            )}

            {!isSearching && filteredPlaces.map((place) => (
              <PlaceCard 
                key={place.place_id} 
                place={place} 
                isSelected={selectedPlace?.place_id === place.place_id}
                onClick={() => setSelectedPlace(place)}
                analysisResult={analysisResults?.[place.place_id]}
                isAnalyzing={analyzingPlaceId === place.place_id}
                onAnalyzeClick={handleAnalyze}
                onSave={() => handleToggleSave(place)}
                isSaved={savedPlaceIds.has(place.place_id)}
              />
            ))}
          </>
        ) : (
          // Saved Places List
          <>
            {isLoadingSaved ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>読み込み中...</p>
              </div>
            ) : savedPlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                <Bookmark className="w-12 h-12 mb-2 text-slate-300" />
                <p>保存された店舗はありません。</p>
              </div>
            ) : (
              savedPlaces.map(savedPlace => (
                <SavedPlaceCard 
                  key={savedPlace.place_id} 
                  savedPlace={savedPlace} 
                  onStatusChange={handleUpdateStatus}
                  onDelete={handleDeleteSaved}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
