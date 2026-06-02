import React, { useState, useEffect } from 'react';
import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow } from '@vis.gl/react-google-maps';
import { Search, Star, Target, Sparkles, Loader2 } from 'lucide-react';

const MapComponent = ({ places, setPlaces, selectedPlace, setSelectedPlace, searchQuery, setIsSearching, analysisResults, setAnalysisResults, analyzingPlaceId, setAnalyzingPlaceId, setFilterType, setIsBatchAnalyzing }) => {
  const map = useMap();
  const placesLibrary = useMapsLibrary('places');
  const [placesService, setPlacesService] = useState(null);

  // Initial center (e.g., Tokyo)
  const defaultCenter = { lat: 35.6812, lng: 139.7671 };

  useEffect(() => {
    if (!placesLibrary || !map) return;
    setPlacesService(new placesLibrary.PlacesService(map));
  }, [placesLibrary, map]);

  // Execute Search in the current map bounds
  const handleSearchArea = () => {
    if (!placesService || !map || !searchQuery) return;
    
    setIsSearching(true);
    setPlaces([]); // Clear old results
    setSelectedPlace(null);
    if (setFilterType) setFilterType('all');
    if (setIsBatchAnalyzing) setIsBatchAnalyzing(false);

    const request = {
      bounds: map.getBounds(),
      query: searchQuery,
    };

    placesService.textSearch(request, (results, status) => {
      setIsSearching(false);
      if (status === placesLibrary.PlacesServiceStatus.OK && results) {
        // AIの無駄打ちを防ぐための強力な事前フィルター
        const isLikelyChain = (name) => {
          const blacklist = ['星乃珈琲店', 'EARTH', 'スターバックス', 'コメダ珈琲', 'ドトール', 'タリーズ', 'サンマルク', 'プロント', 'エクセルシオール', 'ルノアール', 'マクドナルド', 'モスバーガー', 'ケンタッキー', 'サイゼリヤ', 'ガスト', 'デニーズ', 'すき家', '松屋', '吉野家', '一蘭', 'TBC', 'ミュゼ', '湘南美容', 'RIZAP', 'チョコザップ'];
          if (blacklist.some(chain => name.includes(chain))) return true;
          
          // 商業施設名が含まれる場合はチェーンや大型店の可能性が高い
          if (/(ルミネ|パルコ|マルイ|イオン|イトーヨーカドー|ららぽーと|アトレ|グランデュオ)/.test(name)) return true;
          
          // 「〇〇店」だけで判断するのは厳しすぎたため、一旦コメントアウトまたは条件を限定
          // if (/(店|館|本店|支店|南口|北口|東口|西口)\s*$/.test(name)) return true;
          
          return false;
        };

        const filteredResults = results.filter(place => {
          // 1. 口コミ150件以下（超人気店・大型チェーンを除外）
          const ratingCount = place.user_ratings_total || 0;
          if (ratingCount > 150) return false;
          
          // 2. チェーン店っぽい名前を除外
          if (isLikelyChain(place.name)) return false;
          
          return true;
        });

        setPlaces(filteredResults);
      } else {
        console.error('Places API search failed:', status);
        setPlaces([]);
      }
    });
  };

  const handleAnalyze = async (place) => {
    if ((analysisResults[place.place_id] && !analysisResults[place.place_id].error) || analyzingPlaceId === place.place_id) return;
    
    setAnalyzingPlaceId(place.place_id);
    try {
      let placeToSend = place;

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place: placeToSend })
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysisResults(prev => ({ ...prev, [place.place_id]: data.analysis }));
      } else {
        setAnalysisResults(prev => ({ ...prev, [place.place_id]: { error: true, message: 'エラーが発生しました。' } }));
      }
    } catch (err) {
      setAnalysisResults(prev => ({ ...prev, [place.place_id]: { error: true, message: '通信エラーが発生しました。' } }));
    } finally {
      setAnalyzingPlaceId(null);
    }
  };

  return (
    <div className="w-full h-full relative">
      <Map
        defaultZoom={13}
        defaultCenter={defaultCenter}
        mapId="DEMO_MAP_ID"
        disableDefaultUI={false}
      >
        {places.map((place) => (
          <AdvancedMarker
            key={place.place_id}
            position={{
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            }}
            onClick={() => setSelectedPlace(place)}
          >
            <Pin 
              background={selectedPlace?.place_id === place.place_id ? '#3b82f6' : '#EF4444'}
              borderColor={selectedPlace?.place_id === place.place_id ? '#1d4ed8' : '#b91c1c'}
              glyphColor={'#fff'} 
            />
          </AdvancedMarker>
        ))}

        {selectedPlace && (
          <InfoWindow
            position={{
              lat: selectedPlace.geometry.location.lat(),
              lng: selectedPlace.geometry.location.lng()
            }}
            onCloseClick={() => setSelectedPlace(null)}
            headerContent={<div className="font-bold pr-4 truncate">{selectedPlace.name}</div>}
          >
            <div className="p-1 min-w-[200px]">
              <div className="text-xs text-slate-500 mb-2 truncate">
                {selectedPlace.formatted_address || selectedPlace.vicinity}
              </div>
              
              {selectedPlace.rating && (
                <div className="flex items-center text-xs text-amber-500 font-medium mb-3">
                  <Star className="w-3.5 h-3.5 fill-amber-500 mr-1" />
                  {selectedPlace.rating} <span className="text-slate-400 ml-1">({selectedPlace.user_ratings_total})</span>
                </div>
              )}

              <button
                onClick={() => handleAnalyze(selectedPlace)}
                disabled={analyzingPlaceId === selectedPlace.place_id}
                className={`flex w-full items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  analysisResults?.[selectedPlace.place_id] && !analysisResults[selectedPlace.place_id].error
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-md'
                }`}
              >
                {analyzingPlaceId === selectedPlace.place_id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : analysisResults?.[selectedPlace.place_id] && !analysisResults[selectedPlace.place_id].error ? (
                  <Target className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {analyzingPlaceId === selectedPlace.place_id
                  ? '分析中...'
                  : analysisResults?.[selectedPlace.place_id] && !analysisResults[selectedPlace.place_id].error
                  ? 'AI分析完了'
                  : 'AIターゲット分析'}
              </button>
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Floating Search Area Button */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <button
          onClick={handleSearchArea}
          disabled={!searchQuery}
          className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-xl font-bold transition-all duration-300 ${
            searchQuery 
              ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95' 
              : 'bg-white text-slate-400 cursor-not-allowed'
          }`}
        >
          <Search className="w-5 h-5" />
          {searchQuery ? 'このエリアで再検索' : '検索キーワードを入力してください'}
        </button>
      </div>
    </div>
  );
};

export default MapComponent;
