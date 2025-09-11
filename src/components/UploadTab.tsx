import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface UploadTabProps {
  id: string;
  accept: string;
  multiple: boolean;
  onFiles: (files: FileList) => void;
}

export default function UploadTab({ id, accept, multiple, onFiles }: UploadTabProps) {
  const [previews, setPreviews] = useState<{ url: string; file: File }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const addFiles = (files: FileList) => {
    if (!files.length) return;
    const next = Array.from(files).map((file) => ({
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }));
    setPreviews((prev) => [...prev, ...next]);
    onFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const remove = (url: string) => setPreviews((prev) => prev.filter((p) => p.url !== url));

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={`relative rounded-lg min-h-[250px] bg-[#766DFB] border-2 border-dashed transition-all ${
        isDragging ? 'border-white/80 bg-white/10' : 'border-white/30'
      }`}
    >
      <input id={id} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleInput} />

      {previews.length === 0 && (
        <label htmlFor={id} className="absolute inset-0 flex flex-col items-center justify-center text-white cursor-pointer">
          <div className="bg-white/20 rounded-full p-4 mb-4">
            <Plus className="h-8 w-8" />
          </div>
          <span className="text-lg font-semibold">Upload File</span>
          <span className="text-sm text-white/70 mt-2">Drag &amp; drop or click</span>
        </label>
      )}

      {previews.length > 0 && (
        <div className="p-4 grid grid-cols-3 gap-2">
          {previews.map(({ url, file }) => (
            <div key={url || file.name} className="relative aspect-square rounded overflow-hidden bg-white/20">
              {url ? (
                <img src={url} alt={file.name} className="object-cover w-full h-full" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-xs p-2 text-white/80">
                  {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                </div>
              )}
              <button
                onClick={() => remove(url)}
                className="absolute -top-2 -right-2 bg-black/70 rounded-full p-1 hover:bg-red-600 transition-colors"
                aria-label="Remove"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

