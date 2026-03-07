/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Rocket, 
  Palette, 
  Type as TypeIcon, 
  MessageSquare, 
  Info, 
  Loader2, 
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  RefreshCw,
  Share2,
  LogIn,
  LogOut,
  History,
  User as UserIcon,
  Trash2
} from 'lucide-react';
import { generateBrandAssets, generateLogoImage, BrandAssets } from './services/geminiService';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  deleteDoc
} from 'firebase/firestore';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrandCraftApp />
    </ErrorBoundary>
  );
}

function BrandCraftApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [businessIdea, setBusinessIdea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [assets, setAssets] = useState<BrandAssets | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<(BrandAssets & { id: string, businessIdea: string, createdAt: any })[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              createdAt: Timestamp.now()
            });
          } else {
            // Update only fields that might change, keep createdAt
            await setDoc(userRef, {
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
            }, { merge: true });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // History Listener
  useEffect(() => {
    if (!user || !isAuthReady) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'brands'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any;
      setHistory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/brands`);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAssets(null);
      setLogoUrl(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessIdea.trim() || !user) return;

    setIsLoading(true);
    setAssets(null);
    setLogoUrl(null);
    setError(null);

    try {
      const generatedAssets = await generateBrandAssets(businessIdea);
      setAssets(generatedAssets);
      
      setIsGeneratingLogo(true);
      const logo = await generateLogoImage(generatedAssets.logoPrompt);
      setLogoUrl(logo);

      // Save to Firestore
      const brandsRef = collection(db, 'users', user.uid, 'brands');
      await addDoc(brandsRef, {
        ...generatedAssets,
        businessIdea,
        logoUrl: logo,
        userId: user.uid,
        createdAt: Timestamp.now()
      });
    } catch (err: any) {
      console.error("Generation failed:", err);
      let errorMessage = err.message || "An unexpected error occurred.";
      
      if (err.message?.includes("API_KEY_INVALID")) {
        errorMessage = "Invalid Gemini API Key. Please check your .env file and ensure the key is correct.";
      } else if (err.message?.includes("quota")) {
        errorMessage = "API Quota exceeded. You may have reached the free tier limit. Please try again later.";
      } else if (err.message?.includes("not found")) {
        errorMessage = "Gemini API Key not found. Ensure VITE_GEMINI_API_KEY is set in your .env file and you have restarted the server.";
      } else if (err.message?.includes("model")) {
        errorMessage = `Model error: ${err.message}. The selected AI model might not be available in your region or for your API key.`;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsGeneratingLogo(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'brands', brandId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/brands/${brandId}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-900/5 border border-black/5 text-center"
        >
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-600/20">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">BrandCraft AI</h1>
          <p className="text-black/60 mb-10 leading-relaxed">
            Craft your brand identity in seconds. Sign in to start generating and saving your brand assets.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black/80 transition-all shadow-xl shadow-black/10"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">BrandCraft AI</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-full transition-colors ${showHistory ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-black/5 text-black/60'}`}
              title="History"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="h-8 w-[1px] bg-black/5 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none">{user.displayName}</p>
                <p className="text-[10px] text-black/40">{user.email}</p>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-black/10" />
              ) : (
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors text-black/40"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {showHistory ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold tracking-tight">Your Brand History</h2>
              <button 
                onClick={() => setShowHistory(false)}
                className="text-emerald-600 font-bold text-sm hover:underline"
              >
                Back to Generator
              </button>
            </div>
            
            {history.length === 0 ? (
              <div className="py-20 text-center text-black/20">
                <History className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p className="text-lg font-medium">No brands generated yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((item) => (
                  <motion.div 
                    layoutId={item.id}
                    key={item.id}
                    className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-shadow group relative"
                  >
                    <button 
                      onClick={() => handleDeleteBrand(item.id)}
                      className="absolute top-4 right-4 p-2 text-black/20 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="aspect-square bg-emerald-50 rounded-2xl mb-4 overflow-hidden border border-emerald-100">
                      {item.logoUrl ? (
                        <img src={item.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-emerald-200">
                          <ImageIcon className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-xl mb-1 truncate">
                      {typeof item.brandNames[0] === 'string' ? item.brandNames[0] : item.brandNames[0].name}
                    </h3>
                    <p className="text-xs text-black/40 mb-4 line-clamp-2">{item.businessIdea}</p>
                    <button 
                      onClick={() => {
                        setAssets(item);
                        setLogoUrl(item.logoUrl);
                        setShowHistory(false);
                      }}
                      className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                    >
                      View Details
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="max-w-3xl mx-auto text-center mb-16">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
              >
                Your brand, <br />
                <span className="text-emerald-600">crafted in seconds.</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-black/60 mb-10 leading-relaxed"
              >
                Turn your business idea into a complete brand identity. Names, taglines, logos, and content—all powered by advanced Generative AI.
              </motion.p>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium flex items-center gap-3 justify-center"
                >
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  {error}
                </motion.div>
              )}

              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onSubmit={handleGenerate}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex flex-col md:flex-row gap-3 p-2 bg-white border border-black/10 rounded-2xl shadow-xl shadow-black/5">
                  <input
                    type="text"
                    placeholder="Describe your business idea..."
                    className="flex-1 bg-transparent px-4 py-3 outline-none text-lg"
                    value={businessIdea}
                    onChange={(e) => setBusinessIdea(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !businessIdea.trim()}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Generate <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            </div>

            {/* Results Section */}
            <AnimatePresence mode="wait">
              {assets && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                >
                  {/* Left Column: Core Identity */}
                  <div className="lg:col-span-8 space-y-8">
                    {/* Brand Names & Taglines */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 text-emerald-600">
                          <TypeIcon className="w-5 h-5" />
                          <h2 className="font-bold uppercase tracking-widest text-xs">Brand Names</h2>
                        </div>
                        <div className="space-y-3">
                          {assets.brandNames.map((brand, i) => (
                            <motion.div 
                              key={`${brand.name}-${i}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex flex-col p-4 bg-emerald-50/50 rounded-xl group hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-lg">{brand.name}</span>
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              {brand.availabilityNotes && (
                                <p className="text-[10px] text-black/40 mt-1">{brand.availabilityNotes}</p>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </section>

                      <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 text-emerald-600">
                          <Rocket className="w-5 h-5" />
                          <h2 className="font-bold uppercase tracking-widest text-xs">Taglines</h2>
                        </div>
                        <div className="space-y-4">
                          {assets.taglines.map((tagline, i) => (
                            <motion.div 
                              key={`${tagline}-${i}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: (i + 5) * 0.1 }}
                              className="italic text-black/70 border-l-2 border-emerald-200 pl-4 py-1"
                            >
                              "{tagline}"
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    </div>

                    {/* Brand Description */}
                    <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                      <div className="flex items-center gap-2 mb-6 text-emerald-600">
                        <Info className="w-5 h-5" />
                        <h2 className="font-bold uppercase tracking-widest text-xs">Brand Story</h2>
                      </div>
                      <p className="text-xl leading-relaxed text-black/80 font-medium">
                        {assets.description}
                      </p>
                    </section>

                    {/* Social Media Caption */}
                    <section className="bg-black text-white p-8 rounded-3xl shadow-xl">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <MessageSquare className="w-5 h-5" />
                          <h2 className="font-bold uppercase tracking-widest text-xs">Social Media Launch</h2>
                        </div>
                        <button className="text-white/40 hover:text-white transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <p className="whitespace-pre-wrap leading-relaxed text-white/90">
                          {assets.socialMediaCaption}
                        </p>
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Visuals & Analysis */}
                  <div className="lg:col-span-4 space-y-8">
                    {/* Logo Preview */}
                    <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between mb-6 text-emerald-600">
                        <div className="flex items-center gap-2">
                          <Palette className="w-5 h-5" />
                          <h2 className="font-bold uppercase tracking-widest text-xs">Logo Concept</h2>
                        </div>
                      </div>
                      
                      <div className="aspect-square bg-emerald-50 rounded-2xl flex items-center justify-center relative group overflow-hidden border border-emerald-100">
                        {logoUrl ? (
                          <img 
                            src={logoUrl} 
                            alt="Generated Logo" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-emerald-600/40">
                            {isGeneratingLogo ? (
                              <>
                                <Loader2 className="w-10 h-10 animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-widest">Generating...</span>
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-10 h-10" />
                                <span className="text-xs font-bold uppercase tracking-widest">No Logo Generated</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Design Prompt</h3>
                        <p className="text-xs text-black/60 leading-relaxed italic">
                          {assets.logoPrompt}
                        </p>
                      </div>
                    </section>

                    {/* Tone Analysis */}
                    {assets.toneAnalysis && (
                      <section className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100">
                        <div className="flex items-center gap-2 mb-6 text-emerald-700">
                          <Sparkles className="w-5 h-5" />
                          <h2 className="font-bold uppercase tracking-widest text-xs">Tone & Sentiment</h2>
                        </div>
                        
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/50 mb-2">Sentiment</h3>
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 bg-emerald-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600 w-[85%]"></div>
                              </div>
                              <span className="text-xs font-bold text-emerald-700">{assets.toneAnalysis.sentiment}</span>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/50 mb-2">Tone</h3>
                            <span className="text-lg font-bold text-emerald-900">{assets.toneAnalysis.tone}</span>
                          </div>

                          <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/50 mb-2">Keywords</h3>
                            <div className="flex flex-wrap gap-2">
                              {assets.toneAnalysis.keywords?.map(keyword => (
                                <span key={keyword} className="bg-white px-3 py-1 rounded-full text-xs font-medium text-emerald-700 border border-emerald-200">
                                  #{keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty State / Loading State */}
            {!assets && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-black/20">
                <Rocket className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Enter your business idea to start crafting</p>
              </div>
            )}

            {isLoading && !assets && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mb-6" />
                <p className="text-xl font-bold animate-pulse text-black/60">Crafting your brand identity...</p>
                <div className="mt-8 flex gap-2">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                      className="w-2 h-2 bg-emerald-600 rounded-full"
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">BrandCraft AI</span>
          </div>
          <p className="text-sm text-black/40">© 2026 BrandCraft AI. Built with Gemini & Firebase.</p>
          <div className="flex items-center gap-6 text-sm font-medium text-black/60">
            <a href="#" className="hover:text-black transition-colors">Twitter</a>
            <a href="#" className="hover:text-black transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-black transition-colors">Instagram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
