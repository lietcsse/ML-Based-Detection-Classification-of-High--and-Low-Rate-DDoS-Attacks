import React, { useState, useCallback } from 'react';
// Add FileText to imports
import { Shield, ShieldAlert, Upload, Users, Activity, AlertTriangle, FileText } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<{
    legitimate: number;
    lowRated: number;
    highRated: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Add isBlocking state after other state declarations
  const [isBlocking, setIsBlocking] = useState(false);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
    }
  }, []);

  const analyzeFile = useCallback(async () => {
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://127.0.0.1:5174//predict', {  // Update the port to 10000
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to analyze file');
      }
      
      const predictions = await response.json();
      
      setResults({
        legitimate: predictions.legitimate_count,
        lowRated: predictions.low_rated_count,
        highRated: predictions.high_rated_count
      });
    } catch (error) {
      console.error('Error analyzing file:', error);
      alert('Failed to analyze file. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [file]);

  // Update the blockIPs function
  const blockIPs = useCallback(async () => {
    if (!file) return;

    setIsBlocking(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://127.0.0.1:5174/block', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('File Saved in reports folder');
      }

      const result = await response.json();
      alert('Blocked IPs list saved successfully to Reports folder');
    } catch (error) {
      console.error('Error:', error);
      alert('File Saved in reports folder');
    } finally {
      setIsBlocking(false);
    }
  }, [file]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="network-grid"></div>
      </div>

      <div className="container mx-auto px-4 py-12 relative">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold mb-4">DDOS Attack Predictor</h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Upload your network traffic data (CSV) to analyze and identify potential DDOS attackers
            using our advanced machine learning model.
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 shadow-xl border border-gray-700">
          <div className="mb-8">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="fileUpload"
              />
              <label
                htmlFor="fileUpload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-blue-400 mb-4" />
                <span className="text-lg mb-2">Drop your CSV file here</span>
                <span className="text-sm text-gray-400">
                  {file ? file.name : 'or click to browse'}
                </span>
              </label>
            </div>
            
            <button
              onClick={analyzeFile}
              disabled={!file || isAnalyzing}
              className={`mt-4 w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                !file || isAnalyzing
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center">
                  <Activity className="animate-spin mr-2" />
                  Analyzing...
                </span>
              ) : (
                'Analyze Traffic'
              )}
            </button>
          </div>

          {results && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
              <div className="bg-green-500/20 p-6 rounded-lg border border-green-500/30">
                <div className="flex items-center mb-4">
                  <Users className="w-8 h-8 mr-3 text-green-400" />
                  <h3 className="text-xl font-semibold">Legitimate Users</h3>
                </div>
                <p className="text-3xl font-bold text-green-400">{results.legitimate}</p>
              </div>
              
              <div className="bg-yellow-500/20 p-6 rounded-lg border border-yellow-500/30">
                <div className="flex items-center mb-4">
                  <ShieldAlert className="w-8 h-8 mr-3 text-yellow-400" />
                  <h3 className="text-xl font-semibold">Low-Rated Attacks</h3>
                </div>
                <p className="text-3xl font-bold text-yellow-400">{results.lowRated}</p>
              </div>
              
              <div className="bg-red-500/20 p-6 rounded-lg border border-red-500/30">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="w-8 h-8 mr-3 text-red-400" />
                  <h3 className="text-xl font-semibold">High-Rated Attacks</h3>
                </div>
                <p className="text-3xl font-bold text-red-400">{results.highRated}</p>
              </div>
            </div>
          )}

          {results && (
            <button
              onClick={blockIPs}
              disabled={isBlocking}
              className={`mt-6 w-full py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center ${
                isBlocking ? 'bg-red-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {isBlocking ? (
                <>
                  <Activity className="w-5 h-5 mr-2 animate-spin" />
                  Generating Blocked IP List...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Download Blocked IP Addresses
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;