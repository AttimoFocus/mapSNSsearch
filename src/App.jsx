import React, { useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import { MapPin } from 'lucide-react';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';

function App() {
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [analysisResults, setAnalysisResults] = useState({});
  const [analyzingPlaceId, setAnalyzingPlaceId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'map'

  // NOTE: In production, NEVER expose the raw API key like this if it's not restricted.
  // Vite exposes env vars prefixed with VITE_ to the client.
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="max-w-md p-8 bg-slate-800 rounded-xl shadow-2xl text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-blue-500" />
          <h1 className="text-2xl font-bold mb-4">APIキーが設定されていません</h1>
          <p className="text-slate-300">
            <code>.env</code> ファイルを作成し、<code>VITE_GOOGLE_MAPS_API_KEY</code> を設定してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedOut>
        <div className="flex h-screen items-center justify-center bg-slate-900">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <APIProvider apiKey={apiKey}>
          <div className="flex h-screen w-full bg-slate-100 overflow-hidden relative">
            {/* Sidebar */}
            <div className={`w-full md:w-96 h-full flex flex-col z-20 ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
              <Sidebar 
                places={places} 
                selectedPlace={selectedPlace}
                setSelectedPlace={setSelectedPlace}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSearching={isSearching}
                analysisResults={analysisResults}
                setAnalysisResults={setAnalysisResults}
                analyzingPlaceId={analyzingPlaceId}
                setAnalyzingPlaceId={setAnalyzingPlaceId}
                filterType={filterType}
                setFilterType={setFilterType}
                isBatchAnalyzing={isBatchAnalyzing}
                setIsBatchAnalyzing={setIsBatchAnalyzing}
              />
            </div>
            
            {/* Map Area */}
            <div className={`flex-1 relative h-full ${mobileView === 'map' ? 'block' : 'hidden md:block'}`}>
              <MapComponent 
                places={places} 
                setPlaces={setPlaces}
                selectedPlace={selectedPlace}
                setSelectedPlace={setSelectedPlace}
                searchQuery={searchQuery}
                setIsSearching={setIsSearching}
                analysisResults={analysisResults}
                setAnalysisResults={setAnalysisResults}
                analyzingPlaceId={analyzingPlaceId}
                setAnalyzingPlaceId={setAnalyzingPlaceId}
                setFilterType={setFilterType}
                setIsBatchAnalyzing={setIsBatchAnalyzing}
              />
            </div>

            {/* Mobile View Selector Floating Button */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 md:hidden flex bg-slate-900/90 backdrop-blur-md p-1 rounded-full shadow-lg border border-slate-700">
              <button
                onClick={() => setMobileView('list')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${mobileView === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                📋 リスト
              </button>
              <button
                onClick={() => setMobileView('map')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${mobileView === 'map' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                🗺️ 地図
              </button>
            </div>
          </div>
        </APIProvider>
      </SignedIn>
    </>
  );
}

export default App;
