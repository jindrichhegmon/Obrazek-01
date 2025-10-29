
import React, { useState, useRef, useCallback, useEffect, MouseEvent } from 'react';
import { editImageWithGemini, ImageData, GeneratedImageData } from './services/geminiService';
import Spinner from './components/Spinner';
import { UploadIcon, SparklesIcon, DownloadIcon, BackIcon, ErrorIcon, ImageIcon, CloseIcon, TextIcon, CropIcon } from './components/icons';

type OriginalImage = {
  url: string;
  mimeType: string;
};

// A new component for cropping the image before editing
const ImageCropper: React.FC<{
  imageUrl: string;
  onCropComplete: (image: OriginalImage) => void;
  onCancel: () => void;
}> = ({ imageUrl, onCropComplete, onCancel }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const [cropEnd, setCropEnd] = useState({ x: 0, y: 0 });

  const getCropRect = () => {
    if (!isCropping && cropStart.x === 0 && cropEnd.x === 0) return null;

    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropStart.x - cropEnd.x);
    const height = Math.abs(cropStart.y - cropEnd.y);

    if (width === 0 || height === 0) return null;
    
    return { x, y, width, height };
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStart({ x, y });
    setCropEnd({ x, y });
    setIsCropping(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isCropping || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCropEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  
  const handleMouseUp = () => {
    setIsCropping(false);
  };
  
  const handleConfirmCrop = () => {
    const image = imgRef.current;
    const cropRect = getCropRect();
    if (!image || !cropRect || cropRect.width === 0 || cropRect.height === 0) {
        // If no crop is selected, use the full image.
        onCropComplete({ url: imageUrl, mimeType: 'image/png' }); // Assuming PNG might not be correct but it's a fallback.
        return;
    };

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const sourceX = cropRect.x * scaleX;
    const sourceY = cropRect.y * scaleY;
    const sourceWidth = cropRect.width * scaleX;
    const sourceHeight = cropRect.height * scaleY;

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

    const croppedImageUrl = canvas.toDataURL('image/png');
    onCropComplete({ url: croppedImageUrl, mimeType: 'image/png' });
  };

  const cropRectStyle = getCropRect();

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <header className="w-full p-4 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20 flex items-center">
        <button onClick={onCancel} className="flex items-center text-sm font-semibold text-gray-300 hover:text-white transition-colors">
          <BackIcon className="w-5 h-5 mr-2" />
          Back to Upload
        </button>
      </header>
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-200">Crop Your Image</h2>
        <p className="text-gray-400 mb-6">Click and drag on the image to select an area.</p>
        <div
          ref={containerRef}
          className="relative select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="To be cropped"
            className="max-w-[80vw] max-h-[60vh] object-contain"
            draggable={false}
          />
          {cropRectStyle && (
            <div
              className="absolute border-2 border-dashed border-indigo-400 bg-indigo-500/20"
              style={{
                left: cropRectStyle.x,
                top: cropRectStyle.y,
                width: cropRectStyle.width,
                height: cropRectStyle.height,
              }}
            />
          )}
        </div>
      </main>
      <footer className="w-full p-4 bg-gray-900/80 backdrop-blur-sm sticky bottom-0 z-20 mt-auto">
        <div className="max-w-4xl mx-auto flex justify-center">
            <button
                onClick={handleConfirmCrop}
                className="flex items-center justify-center bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg shadow-indigo-500/30"
            >
                <CropIcon className="w-6 h-6 mr-2" />
                Confirm Crop
            </button>
        </div>
      </footer>
    </div>
  );
};


const fileToDataUrl = (file: File): Promise<OriginalImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        mimeType: file.type,
      });
    };
    reader.onerror = (error) => reject(error);
  });
};

const applyTextOverlay = (
    base64Image: string, 
    text: string, 
    options: { fontFamily: string; fontSize: number; textColor: string; textPosition: string; }
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            // Draw the original image
            ctx.drawImage(img, 0, 0);

            // Style the text
            ctx.font = `${options.fontSize}px ${options.fontFamily}`;
            ctx.fillStyle = options.textColor;
            
            // Add a simple shadow for better visibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            let x, y;
            const padding = Math.min(canvas.width, canvas.height) * 0.05;

            switch (options.textPosition) {
                case 'top-left':
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    x = padding;
                    y = padding;
                    break;
                case 'top-center':
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    x = canvas.width / 2;
                    y = padding;
                    break;
                case 'top-right':
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                    x = canvas.width - padding;
                    y = padding;
                    break;
                case 'middle-left':
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    x = padding;
                    y = canvas.height / 2;
                    break;
                case 'middle-right':
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'middle';
                    x = canvas.width - padding;
                    y = canvas.height / 2;
                    break;
                case 'bottom-left':
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    x = padding;
                    y = canvas.height - padding;
                    break;
                case 'bottom-center':
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    x = canvas.width / 2;
                    y = canvas.height - padding;
                    break;
                case 'bottom-right':
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'bottom';
                    x = canvas.width - padding;
                    y = canvas.height - padding;
                    break;
                case 'center':
                default:
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    x = canvas.width / 2;
                    y = canvas.height / 2;
                    break;
            }

            // Draw the text in the calculated position
            ctx.fillText(text, x, y);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (error) => {
            reject(new Error('Failed to load image for text overlay.'));
        };
        img.src = base64Image;
    });
};


const App: React.FC = () => {
  const [uncroppedImage, setUncroppedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<OriginalImage | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<OriginalImage | null>(null);
  const [imageBeforeText, setImageBeforeText] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Text overlay state
  const [textOverlay, setTextOverlay] = useState('');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(48);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textPosition, setTextPosition] = useState('center');
  const [isTextToolsVisible, setIsTextToolsVisible] = useState(false);

  // Download format state
  const [outputFormat, setOutputFormat] = useState('png');
  const [aspectRatio, setAspectRatio] = useState('original');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const textPositions = [
    'top-left', 'top-center', 'top-right', 
    'middle-left', 'center', 'middle-right', 
    'bottom-left', 'bottom-center', 'bottom-right'
  ];

  const EXAMPLE_PROMPTS = [
    "Add a dog in the foreground",
    "Place a retro car on the street",
    "Change the background to a serene beach",
    "Apply a vintage photo filter",
    "Make the sky look like a Van Gogh painting",
    "Add a pair of sunglasses on the person",
  ];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const imageData = await fileToDataUrl(file);
        setUncroppedImage(imageData.url); // Go to cropper view
        setOriginalImage(null);
        resetEditorState();
      } catch (err) {
        setError('Failed to load image. Please try another file.');
        console.error(err);
      }
    }
  };
  
  const handleCropComplete = (croppedImage: OriginalImage) => {
    setOriginalImage(croppedImage);
    setUncroppedImage(null); // Exit cropper view
  };

  const handleCropCancel = () => {
    setUncroppedImage(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }

  const handleBackgroundFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        try {
            const imageData = await fileToDataUrl(file);
            setBackgroundImage(imageData);
            setPrompt("Replace the background of the first image with the second image.");
        } catch (err) {
            setError('Failed to load background image. Please try another file.');
            console.error(err);
        }
    }
  };

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
    if (prompt === "Replace the background of the first image with the second image.") {
        setPrompt("");
    }
    if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt || !originalImage) {
      setError('Please enter a prompt and upload an image first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEditedImage(null);
    setImageBeforeText(null);

    try {
      const originalImagePayload: ImageData = {
        base64Data: originalImage.url.split(',')[1],
        mimeType: originalImage.mimeType,
      };
      
      const backgroundImagePayload: ImageData | undefined = backgroundImage ? {
        base64Data: backgroundImage.url.split(',')[1],
        mimeType: backgroundImage.mimeType,
      } : undefined;
      
      const generatedImage: GeneratedImageData = await editImageWithGemini(
        originalImagePayload,
        prompt,
        backgroundImagePayload,
        aspectRatio
      );
      const generatedImageWithDataUrl = `data:${generatedImage.mimeType};base64,${generatedImage.base64Data}`;
      setImageBeforeText(generatedImageWithDataUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Generation failed: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, originalImage, backgroundImage, aspectRatio]);

  // Effect to apply text overlay reactively
  useEffect(() => {
    const applyText = async () => {
        if (!imageBeforeText) {
            setEditedImage(null);
            return;
        };

        if (textOverlay.trim()) {
            try {
                const finalImage = await applyTextOverlay(imageBeforeText, textOverlay, { fontFamily, fontSize, textColor, textPosition });
                setEditedImage(finalImage);
            } catch (err) {
                setError("Failed to apply text overlay.");
                console.error(err);
            }
        } else {
            setEditedImage(imageBeforeText);
        }
    };

    applyText();
  }, [textOverlay, fontFamily, fontSize, textColor, textPosition, imageBeforeText]);
  
  const handleDownload = () => {
    if (!editedImage) return;

    const mimeType = `image/${outputFormat}`;
    const fileExtension = outputFormat;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // If converting to a format that doesn't support transparency (like JPEG),
      // fill the background with white first.
      if (outputFormat === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      // For JPEG, we can also specify quality (0.0 to 1.0)
      const dataUrl = canvas.toDataURL(mimeType, 0.95);

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `edited-image.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.onerror = () => {
      setError('Failed to process image for download.');
    };
    img.src = editedImage;
  };

  const handleOriginalImageDownload = () => {
    if (!originalImage) return;
    const a = document.createElement('a');
    a.href = originalImage.url;
    
    const mimeTypeMap: { [key: string]: string } = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    const extension = mimeTypeMap[originalImage.mimeType] || 'png';
    a.download = `original.${extension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBackgroundImageDownload = () => {
    if (!backgroundImage) return;
    const a = document.createElement('a');
    a.href = backgroundImage.url;
    
    const mimeTypeMap: { [key: string]: string } = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    const extension = mimeTypeMap[backgroundImage.mimeType] || 'png';
    a.download = `background.${extension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetEditorState = () => {
    setEditedImage(null);
    setImageBeforeText(null);
    setError(null);
    setPrompt('');
    setTextOverlay('');
    setIsTextToolsVisible(false);
    setOutputFormat('png');
    setAspectRatio('original');
    setTextPosition('center');
  }

  const reset = () => {
    setOriginalImage(null);
    setUncroppedImage(null);
    setBackgroundImage(null);
    resetEditorState();
    setIsLoading(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
    }
  };

  const Uploader = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-900">
      <div className="max-w-2xl w-full">
        <SparklesIcon className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600 mb-2">
          Gemini Image Editor
        </h1>
        <p className="text-lg text-gray-300 mb-8">
          Bring your creative visions to life. Describe the edits, and let AI do the magic.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30"
        >
          <UploadIcon className="w-6 h-6 mr-2" />
          Upload an Image
        </button>
      </div>
    </div>
  );

  const Editor = () => (
    <div className="min-h-screen flex flex-col">
       <header className="w-full p-4 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20 flex items-center">
         <button onClick={reset} className="flex items-center text-sm font-semibold text-gray-300 hover:text-white transition-colors">
            <BackIcon className="w-5 h-5 mr-2" />
            Start Over
        </button>
      </header>

      <main className="flex-grow p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col items-center justify-center bg-gray-800 rounded-xl p-4 aspect-square sticky top-24">
            <div className="w-full flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-300">Original Image</h2>
              <button
                onClick={handleOriginalImageDownload}
                className="p-2 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                aria-label="Download Original Image"
                title="Download Original Image"
              >
                <DownloadIcon className="w-5 h-5" />
              </button>
            </div>
            <img src={originalImage!.url} alt="Original" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"/>
        </div>

        <div className="flex flex-col items-center justify-center">
            <div className="w-full flex flex-col items-center justify-center bg-gray-800 rounded-xl p-4 aspect-square">
                <h2 className="text-xl font-bold mb-4 text-gray-300">Edited Image</h2>
                <div className="w-full h-full flex items-center justify-center bg-gray-900/50 rounded-lg">
                    {isLoading && <Spinner />}
                    {error && !isLoading && (
                        <div className="text-center text-red-400 p-4 border-2 border-dashed border-red-400/50 rounded-lg">
                            <ErrorIcon className="w-12 h-12 mx-auto mb-2" />
                            <p className="font-semibold">Oops! Something went wrong.</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {editedImage && !isLoading && (
                         <img src={editedImage} alt="Edited" className="max-w-full max-h-[70vh] object-contain rounded-lg"/>
                    )}
                     {!isLoading && !editedImage && !error && (
                        <div className="text-center text-gray-400">
                            <SparklesIcon className="w-12 h-12 mx-auto mb-2" />
                            <p>Your generated image will appear here.</p>
                        </div>
                     )}
                </div>
            </div>
            {editedImage && !isLoading && (
                <div className="mt-4 w-full bg-gray-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <h3 className="text-md font-semibold text-gray-300">Download Options:</h3>
                    <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="w-full sm:w-auto bg-gray-700 text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                    >
                        <option value="png">PNG</option>
                        <option value="jpeg">JPEG</option>
                        <option value="webp">WEBP</option>
                    </select>
                    <button
                        onClick={handleDownload}
                        className="w-full sm:w-auto flex items-center justify-center bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        Download
                    </button>
                </div>
            )}
        </div>
      </main>

      <footer className="w-full p-4 bg-gray-900/80 backdrop-blur-sm sticky bottom-0 z-20 mt-auto">
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-3 justify-center">
                {EXAMPLE_PROMPTS.map(p => (
                    <button key={p} onClick={() => setPrompt(p)} className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 hover:text-white transition-colors">
                        {p}
                    </button>
                ))}
            </div>

            <div className="mb-4 flex flex-wrap justify-center items-center gap-4">
              {!backgroundImage ? (
                  <>
                      <input
                          type="file"
                          ref={backgroundInputRef}
                          onChange={handleBackgroundFileChange}
                          accept="image/*"
                          className="hidden"
                      />
                      <button
                          onClick={() => backgroundInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
                          aria-label="Upload a background image"
                      >
                          <ImageIcon className="w-5 h-5" />
                          Upload Background
                      </button>
                  </>
              ) : (
                  <div>
                      <p className="text-sm text-gray-400 mb-2 text-center">Background:</p>
                      <div className="relative w-max mx-auto group">
                          <img src={backgroundImage.url} alt="Background thumbnail" className="h-14 w-auto rounded-md object-cover shadow-md" />
                          <button
                              onClick={removeBackgroundImage}
                              className="absolute -top-2 -right-2 bg-gray-800 rounded-full p-1 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                              aria-label="Remove background image"
                          >
                              <CloseIcon className="w-4 h-4" />
                          </button>
                          <button
                              onClick={handleBackgroundImageDownload}
                              className="absolute bottom-1 right-1 bg-gray-800/70 backdrop-blur-sm rounded-full p-1 text-gray-300 hover:text-white hover:bg-gray-700 transition-opacity opacity-0 group-hover:opacity-100"
                              aria-label="Download background image"
                              title="Download background image"
                          >
                              <DownloadIcon className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              )}
              {imageBeforeText && (
                 <button
                    onClick={() => setIsTextToolsVisible(!isTextToolsVisible)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${isTextToolsVisible ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    aria-label="Toggle text overlay tools"
                  >
                    <TextIcon className="w-5 h-5" />
                    Add Text
                  </button>
              )}
               <div className="flex items-center gap-2">
                  <label htmlFor="aspect-ratio-select" className="text-sm text-gray-400">Aspect Ratio:</label>
                  <select
                      id="aspect-ratio-select"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="bg-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                  >
                      <option value="original">Original</option>
                      <option value="16:9">16:9</option>
                      <option value="4:3">4:3</option>
                  </select>
              </div>
            </div>
            
            {isTextToolsVisible && imageBeforeText && (
                <div className="flex flex-col gap-4 bg-gray-800/50 p-3 rounded-lg mb-4 border border-gray-700">
                    <input
                        type="text"
                        placeholder="Your text here..."
                        value={textOverlay}
                        onChange={(e) => setTextOverlay(e.target.value)}
                        className="w-full bg-gray-700 text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="text-sm text-gray-400 block mb-1">Font</label>
                             <select 
                                value={fontFamily} 
                                onChange={e => setFontFamily(e.target.value)}
                                className="w-full bg-gray-700 text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                            >
                                <option>Arial</option>
                                <option>Verdana</option>
                                <option>Georgia</option>
                                <option>Times New Roman</option>
                                <option>Courier New</option>
                                <option>Impact</option>
                            </select>
                        </div>
                        <div>
                           <label htmlFor="font-size" className="text-sm text-gray-400 block mb-1">Size</label>
                            <div className="flex items-center gap-2 bg-gray-700 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                                <input
                                    id="font-size"
                                    type="number"
                                    value={fontSize}
                                    onChange={e => setFontSize(parseInt(e.target.value, 10) || 1)}
                                    className="w-full bg-transparent text-gray-100 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="font-color" className="text-sm text-gray-400 block mb-1">Color</label>
                            <div className="flex items-center bg-gray-700 rounded-md p-1 h-[42px] focus-within:ring-2 focus-within:ring-indigo-500">
                                <input
                                    id="font-color"
                                    type="color"
                                    value={textColor}
                                    onChange={e => setTextColor(e.target.value)}
                                    className="w-full h-full bg-transparent border-none cursor-pointer"
                                    title="Select text color"
                                />
                            </div>
                        </div>
                         <div className="col-span-2 sm:col-span-1">
                             <label className="text-sm text-gray-400 text-center block mb-1">Position</label>
                             <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-900/50 rounded-md max-w-[100px] mx-auto">
                                {textPositions.map(pos => (
                                    <button
                                        key={pos}
                                        onClick={() => setTextPosition(pos)}
                                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${textPosition === pos ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        title={`Position: ${pos.replace('-', ' ')}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${textPosition === pos ? 'bg-white' : 'bg-gray-400'}`}></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-2 shadow-lg">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    placeholder="Describe your edit... e.g., 'Add a retro filter'"
                    className="w-full bg-transparent focus:outline-none text-gray-100 placeholder-gray-500 p-2"
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt}
                    className="flex items-center justify-center bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed shrink-0"
                >
                    <SparklesIcon className="w-5 h-5 mr-0 sm:mr-2" />
                    <span className="hidden sm:inline">{isLoading ? 'Generating...' : 'Generate'}</span>
                </button>
            </div>
        </div>
      </footer>
    </div>
  );

  if (uncroppedImage) {
    return <ImageCropper imageUrl={uncroppedImage} onCropComplete={handleCropComplete} onCancel={handleCropCancel} />
  }

  return originalImage ? <Editor /> : <Uploader />;
};

export default App;
