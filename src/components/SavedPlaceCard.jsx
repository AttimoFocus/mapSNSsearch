import React, { useState } from 'react';
import { Target, Star, MapPin, Instagram, Bookmark, CheckCircle2, Phone, XCircle, ChevronDown, Trash2 } from 'lucide-react';

const SavedPlaceCard = ({ savedPlace, onStatusChange, onDelete }) => {
  const { place_id, name, address, rating, user_ratings_total, analysis_json, status } = savedPlace;
  const analysis = analysis_json ? JSON.parse(analysis_json) : null;
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setIsUpdating(true);
    await onStatusChange(place_id, newStatus);
    setIsUpdating(false);
  };

  const statusColors = {
    '未対応': 'bg-slate-100 text-slate-600 border-slate-200',
    'テレアポ済み': 'bg-blue-50 text-blue-600 border-blue-200',
    '商談中': 'bg-amber-50 text-amber-600 border-amber-200',
    '失注': 'bg-red-50 text-red-600 border-red-200',
    '成約': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };

  return (
    <div className={`p-4 rounded-xl border transition-all bg-white border-slate-200 shadow-sm relative`}>
      <button 
        onClick={() => onDelete(place_id)}
        className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"
        title="お気に入りから削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <h3 className="font-bold text-slate-800 pr-6 leading-tight mb-2">{name}</h3>
      
      <div className="flex items-start text-xs text-slate-500 mb-2">
        <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0 mt-0.5" />
        <span className="line-clamp-2">{address}</span>
      </div>

      {rating && (
        <div className="flex items-center text-xs font-medium text-amber-500 mb-3">
          <Star className="w-3.5 h-3.5 fill-amber-500 mr-1" />
          {rating} <span className="text-slate-400 ml-1 font-normal">({user_ratings_total})</span>
        </div>
      )}

      {/* CRM Status Dropdown */}
      <div className="mb-4">
        <label className="text-xs font-bold text-slate-500 mb-1 block">営業ステータス</label>
        <div className="relative">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isUpdating}
            className={`w-full appearance-none outline-none border rounded-lg px-3 py-2 text-sm font-bold transition-colors cursor-pointer ${statusColors[status] || statusColors['未対応']} ${isUpdating ? 'opacity-50' : ''}`}
          >
            <option value="未対応">未対応</option>
            <option value="テレアポ済み">テレアポ済み</option>
            <option value="商談中">商談中</option>
            <option value="成約">成約 🎉</option>
            <option value="失注">失注</option>
          </select>
          <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 opacity-50 pointer-events-none" />
        </div>
      </div>

      {analysis && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
              {analysis.businessType || '不明'}
            </span>
            {analysis.score !== undefined && (
              <span className={`text-sm font-black ${analysis.score >= 80 ? 'text-emerald-600' : 'text-blue-600'}`}>
                {analysis.score}点
              </span>
            )}
          </div>
          
          {analysis.summary && (
            <p className="text-xs font-bold text-slate-700 mb-3">{analysis.summary}</p>
          )}

          <div className="space-y-2 mb-3">
            {analysis.sns?.instagram?.exists && (
              <div className="flex items-center text-xs text-pink-600 bg-pink-50 px-2 py-1 rounded">
                <Instagram className="w-3 h-3 mr-1.5" />
                <span>IG: {analysis.sns.instagram.followers}</span>
              </div>
            )}
          </div>
          
          {analysis.salesApproach && (
            <div>
              <div className="text-[10px] font-bold text-blue-600 mb-1 flex items-center">
                <Target className="w-3 h-3 mr-1" />
                営業アプローチ
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-2 rounded border border-slate-100">
                {analysis.salesApproach}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedPlaceCard;
