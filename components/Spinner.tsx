
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex flex-col justify-center items-center text-center p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mb-4"></div>
      <p className="text-indigo-300 font-semibold">Gemini is thinking...</p>
      <p className="text-sm text-gray-400 mt-1">This might take a moment.</p>
    </div>
  );
};

export default Spinner;
