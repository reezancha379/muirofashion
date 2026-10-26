import React, { useMemo, useState, useEffect } from 'react';
import { Lookbook, Product, Testimonial, HeroSlide, Merchant, AffiliateProgram } from '@/types';
import { AffiliateCommerceManager } from './AffiliateCommerceManager';
import { ImageFieldWithUpload } from './ImageFieldWithUpload';
import { api } from '@/lib/api';
import {
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Check,
  Sparkles,
  AlertCircle,
  Save,
  Star,
  CheckCircle2,
  Layers,
  ShoppingBag,
  MessageSquare,
  Clock,
  TrendingUp,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Lock,
  Sliders,
  KeyRound,
  HelpCircle,
  Image as ImageIcon,
  Smartphone,
  QrCode,
  Copy,
  Store,
  RefreshCw
} from 'lucide-react';
import { 
  generateRandomSecret, 
  generateOtpauthUri, 
  generateQrCodeDataUrl, 
  verifyTotpOrKey 
} from '@/lib/totp';

interface AdminManagerProps {
  lookbooks: Lookbook[];
  products: Product[];
  testimonials: Testimonial[];
  heroSlides?: HeroSlide[];
  onRefreshData: () => void;
  onLockSession?: () => void;
}

export const AdminManager: React.FC<AdminManagerProps> = ({
  lookbooks,
  products,
  testimonials,
  heroSlides = [],
  onRefreshData,
  onLockSession
}) => {
  const [activeTab, setActiveTab] = useState<'lookbooks' | 'products' | 'commerce' | 'testimonials' | 'herosection' | 'security'>('lookbooks');

  // Hero Slides List State
  const [heroSlidesList, setHeroSlidesList] = useState<HeroSlide[]>(heroSlides);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [affiliatePrograms, setAffiliatePrograms] = useState<AffiliateProgram[]>([]);

  const fetchHeroSlides = async () => {
    try {
      const slides = await api.getHeroSlides();
      setHeroSlidesList(slides);
    } catch {
      // Keep existing slides if request fails
    }
  };

  useEffect(() => {
    if (heroSlides && heroSlides.length > 0) {
      setHeroSlidesList(heroSlides);
    } else {
      fetchHeroSlides();
    }
  }, [heroSlides]);

  // Admin PIN & Authenticator State
  // Never hold the real passcode in component state -- display a masked hint only.
  const [newAdminPin, setNewAdminPin] = useState<string>('');
  const [confirmAdminPin, setConfirmAdminPin] = useState<string>('');

  // Authenticator (phone app / TOTP) State
  // The pairing secret arrives from the admin-only endpoint at runtime. No
  // compile-time default is held here: this file is bundled into the public
  // JS, so any constant would be a credential anyone could read.
  const [authSecret, setAuthSecret] = useState<string>('');
  const [authEnabled, setAuthEnabled] = useState<boolean>(true);
  const [authQrUrl, setAuthQrUrl] = useState<string>('');
  const [authTestCode, setAuthTestCode] = useState<string>('');
  const [authTestResult, setAuthTestResult] = useState<'valid' | 'invalid' | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([api.getMerchants(), api.getAffiliatePrograms()])
      .then(([merchantRecords, programRecords]) => {
        setMerchants(merchantRecords);
        setAffiliatePrograms(programRecords);
      })
      .catch(() => {
        setMerchants([]);
        setAffiliatePrograms([]);
      });
  }, []);

  useEffect(() => {
    api.getAuthenticatorConfig().then(cfg => {
      if (cfg?.secret) {
        setAuthSecret(cfg.secret);
        setAuthEnabled(cfg.enabled);
        const uri = generateOtpauthUri(cfg.secret, 'admin', 'MUIRO');
        generateQrCodeDataUrl(uri).then(setAuthQrUrl).catch(() => {});
      }
    }).catch(() => {
      // Not signed in, or unreachable. Leave the panel empty instead of
      // falling back to a hardcoded secret that any visitor could also read.
    });
  }, []);

  // Hero Slide Form State
  const [isAddingHeroSlide, setIsAddingHeroSlide] = useState(false);
  const [editingHeroSlide, setEditingHeroSlide] = useState<HeroSlide | null>(null);
  const [hsTitle, setHsTitle] = useState('');
  const [hsTagline, setHsTagline] = useState('');
  const [hsCategory, setHsCategory] = useState('Autumn Essentials');
  const [hsImage, setHsImage] = useState('/hero-1.jpg');
  const [hsFallbackImage, setHsFallbackImage] = useState('https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=800&q=80');
  const [hsLookId, setHsLookId] = useState('look-1');
  const [hsKeyPieces, setHsKeyPieces] = useState('Cable Knit Vest, Tan Loafers, Poplin Shirt');
  const [hsIsActive, setHsIsActive] = useState(true);
  const [hsOrder, setHsOrder] = useState(1);

  // Forms state
  const [isAddingLookbook, setIsAddingLookbook] = useState(false);
  const [editingLookbook, setEditingLookbook] = useState<Lookbook | null>(null);

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isAddingTestimonial, setIsAddingTestimonial] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Lookbook Form state
  const [lbTitle, setLbTitle] = useState('');
  const [lbBoard, setLbBoard] = useState('');
  const [lbCategory, setLbCategory] = useState('Autumn Essentials');
  const [lbCover, setLbCover] = useState('');
  const [lbDescription, setLbDescription] = useState('');
  const [lbAuthorNote, setLbAuthorNote] = useState('');
  const [lbPieces, setLbPieces] = useState<string[]>([]);
  const [lbPieceSearch, setLbPieceSearch] = useState('');
  const [lbPieceCategory, setLbPieceCategory] = useState('all');
  const [lbPieceMerchant, setLbPieceMerchant] = useState('all');
  const [lbPieceProgram, setLbPieceProgram] = useState('all');
  const [lbShowSelectedOnly, setLbShowSelectedOnly] = useState(false);
  const [lbIsNewlyAdded, setLbIsNewlyAdded] = useState(true);
  const [lbIsTrending, setLbIsTrending] = useState(false);
  const [lbFeatured, setLbFeatured] = useState(true);

  // Product Form state
  const [pTitle, setPTitle] = useState('');
  const [pCategory, setPCategory] = useState('Sweaters');
  const [pPrice, setPPrice] = useState('');
  const [pMerchantId, setPMerchantId] = useState('');
  const [pAffiliateProgramId, setPAffiliateProgramId] = useState('');
  const [pImage, setPImage] = useState('');
  const [pAffiliateUrl, setPAffiliateUrl] = useState('');
  const [pCommissionRate, setPCommissionRate] = useState(10);
  const [pDescription, setPDescription] = useState('');
  const [pIsNewlyAdded, setPIsNewlyAdded] = useState(true);
  const [pIsTrending, setPIsTrending] = useState(false);
  const [pFeatured, setPFeatured] = useState(true);

  // Testimonial Form state
  const [tAuthor, setTAuthor] = useState('');
  const [tLocation, setTLocation] = useState('New York, NY');
  const [tAvatar, setTAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80');
  const [tRating, setTRating] = useState(5);
  const [tOutfitTitle, setTOutfitTitle] = useState('');
  const [tComment, setTComment] = useState('');
  const [tVerified, setTVerified] = useState(true);

  // --- Handlers: Quick Toggles ---
  const handleToggleProductStatus = async (product: Product, field: 'isNewlyAdded' | 'isTrending') => {
    try {
      await api.updateProduct(product.id, {
        [field]: !product[field]
      });
      showNotice(`Updated "${product.title}" ${field === 'isNewlyAdded' ? 'newly added' : 'trending'} status`);
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleLookbookStatus = async (look: Lookbook, field: 'isNewlyAdded' | 'isTrending') => {
    try {
      await api.updateLookbook(look.id, {
        [field]: !look[field]
      });
      showNotice(`Updated "${look.title}" ${field === 'isNewlyAdded' ? 'newly added' : 'trending'} status`);
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- Handlers: Lookbooks ---
  const handleSaveLookbook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingLookbook) {
        await api.updateLookbook(editingLookbook.id, {
          title: lbTitle,
          board: lbBoard,
          category: lbCategory,
          cover: lbCover,
          description: lbDescription,
          authorNote: lbAuthorNote,
          pieces: lbPieces,
          isNewlyAdded: lbIsNewlyAdded,
          isTrending: lbIsTrending,
          featured: lbFeatured
        });
        showNotice('Lookbook updated successfully');
        setEditingLookbook(null);
      } else {
        await api.createLookbook({
          title: lbTitle,
          board: lbBoard,
          category: lbCategory,
          cover: lbCover,
          description: lbDescription,
          authorNote: lbAuthorNote,
          pieces: lbPieces,
          isNewlyAdded: lbIsNewlyAdded,
          isTrending: lbIsTrending,
          featured: lbFeatured
        });
        showNotice('New lookbook published');
        setIsAddingLookbook(false);
      }
      onRefreshData();
      resetLookbookForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEditLookbook = (look: Lookbook) => {
    setEditingLookbook(look);
    setLbTitle(look.title);
    setLbBoard(look.board);
    setLbCategory(look.category);
    setLbCover(look.cover);
    setLbDescription(look.description);
    setLbAuthorNote(look.authorNote || '');
    setLbPieces(look.pieces || []);
    setLbIsNewlyAdded(look.isNewlyAdded ?? true);
    setLbIsTrending(look.isTrending ?? false);
    setLbFeatured(look.featured ?? true);
    setIsAddingLookbook(true);
  };

  const lookbookPieceCategories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const lookbookPieceMerchants = useMemo(() => {
    return Array.from(new Set(products.map(p => p.merchant).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const lookbookPiecePrograms = useMemo(() => {
    const ids = Array.from(new Set(products.map(p => p.affiliateProgramId).filter(Boolean))) as string[];
    return ids
      .map(id => affiliatePrograms.find(program => program.id === id))
      .filter((program): program is AffiliateProgram => Boolean(program))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, affiliatePrograms]);

  const filteredLookbookPieces = useMemo(() => {
    const query = lbPieceSearch.trim().toLowerCase();
    return products
      .filter(p => {
        if (lbShowSelectedOnly && !lbPieces.includes(p.id)) return false;
        if (lbPieceCategory !== 'all' && p.category !== lbPieceCategory) return false;
        if (lbPieceMerchant !== 'all' && p.merchant !== lbPieceMerchant) return false;
        if (lbPieceProgram !== 'all' && p.affiliateProgramId !== lbPieceProgram) return false;
        if (!query) return true;
        return [p.title, p.category, p.merchant, p.description, p.id]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aSelected = lbPieces.includes(a.id) ? 0 : 1;
        const bSelected = lbPieces.includes(b.id) ? 0 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        return a.title.localeCompare(b.title);
      });
  }, [products, lbPieces, lbPieceSearch, lbPieceCategory, lbPieceMerchant, lbPieceProgram, lbShowSelectedOnly]);

  const resetLookbookForm = () => {
    setLbTitle('');
    setLbBoard('Autumn Fashion | Fall Outfit Ideas');
    setLbCategory('Autumn Essentials');
    setLbCover('/hero-1.jpg');
    setLbDescription('');
    setLbAuthorNote('');
    setLbPieces([]);
    setLbPieceSearch('');
    setLbPieceCategory('all');
    setLbPieceMerchant('all');
    setLbPieceProgram('all');
    setLbShowSelectedOnly(false);
    setLbIsNewlyAdded(true);
    setLbIsTrending(false);
    setLbFeatured(true);
    setEditingLookbook(null);
  };

  const handleDeleteLookbook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lookbook?')) return;
    try {
      await api.deleteLookbook(id);
      showNotice('Lookbook deleted');
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- Handlers: Products ---
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          title: pTitle,
          price: pPrice || editingProduct?.price || 'See retailer',
          numericPrice: Number(String(pPrice).replace(/[^0-9.]/g, '')) || editingProduct?.numericPrice || 0,
          category: pCategory,
          merchant: merchants.find(m => m.id === pMerchantId)?.name,
          merchantId: pMerchantId,
          affiliateProgramId: pAffiliateProgramId,
          image: pImage,
          affiliateUrl: pAffiliateUrl,
          commissionRate: Number(pCommissionRate),
          description: pDescription,
          isNewlyAdded: pIsNewlyAdded,
          isTrending: pIsTrending,
          featured: pFeatured
        });
        showNotice('Product updated');
        setEditingProduct(null);
      } else {
        await api.createProduct({
          title: pTitle,
          price: pPrice,
          numericPrice: Number(String(pPrice).replace(/[^0-9.]/g, '')),
          category: pCategory,
          merchant: merchants.find(m => m.id === pMerchantId)?.name,
          merchantId: pMerchantId,
          affiliateProgramId: pAffiliateProgramId,
          image: pImage,
          affiliateUrl: pAffiliateUrl,
          commissionRate: Number(pCommissionRate),
          description: pDescription,
          isNewlyAdded: pIsNewlyAdded,
          isTrending: pIsTrending,
          featured: pFeatured
        });
        showNotice('New shoppable product added');
        setIsAddingProduct(false);
      }
      onRefreshData();
      resetProductForm();;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setPTitle(prod.title);
    setPCategory(prod.category || 'Tops');
    setPPrice(prod.price && prod.price !== 'See retailer' ? prod.price : String(prod.numericPrice || ''));
    setPMerchantId(prod.merchantId || merchants.find(m => m.name === prod.merchant)?.id || '');
    setPAffiliateProgramId(prod.affiliateProgramId || merchants.find(m => m.id === (prod.merchantId || merchants.find(m => m.name === prod.merchant)?.id))?.affiliateProgramId || '');
    setPImage(prod.image);
    setPAffiliateUrl(prod.affiliateUrl);
    setPCommissionRate(prod.commissionRate || 10);
    setPDescription(prod.description || '');
    setPIsNewlyAdded(prod.isNewlyAdded ?? true);
    setPIsTrending(prod.isTrending ?? false);
    setPFeatured(prod.featured ?? true);
    setIsAddingProduct(true);
  };

  const resetProductForm = () => {
    setPTitle('');
    setPCategory('Sweaters');
    setPPrice('');
    setPMerchantId('');
    setPAffiliateProgramId('');
    setPImage('');
    setPAffiliateUrl('');
    setPCommissionRate(10);
    setPDescription('');
    setPIsNewlyAdded(true);
    setPIsTrending(false);
    setPFeatured(true);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteProduct(id);
      showNotice('Product removed');
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- Handlers: Testimonials ---
  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingTestimonial) {
        await api.updateTestimonial(editingTestimonial.id, {
          author: tAuthor,
          location: tLocation,
          avatar: tAvatar,
          rating: tRating,
          outfitTitle: tOutfitTitle,
          comment: tComment,
          verified: tVerified
        });
        showNotice('Review updated');
        setEditingTestimonial(null);
      } else {
        await api.createTestimonial({
          author: tAuthor,
          location: tLocation,
          avatar: tAvatar,
          rating: tRating,
          outfitTitle: tOutfitTitle,
          comment: tComment,
          verified: tVerified
        });
        showNotice('New testimonial added');
        setIsAddingTestimonial(false);
      }
      onRefreshData();
      resetTestimonialForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEditTestimonial = (test: Testimonial) => {
    setEditingTestimonial(test);
    setTAuthor(test.author);
    setTLocation(test.location);
    setTAvatar(test.avatar);
    setTRating(test.rating);
    setTOutfitTitle(test.outfitTitle);
    setTComment(test.comment);
    setTVerified(test.verified);
    setIsAddingTestimonial(true);
  };

  const resetTestimonialForm = () => {
    setTAuthor('');
    setTLocation('Verified Buyer');
    setTComment('');
    setTOutfitTitle('');
    setEditingTestimonial(null);
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    try {
      await api.deleteTestimonial(id);
      showNotice('Testimonial deleted');
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- Handlers: Hero Slides ---
  const handleSaveHeroSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const piecesArray = hsKeyPieces
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (editingHeroSlide) {
        await api.updateHeroSlide(editingHeroSlide.id, {
          title: hsTitle,
          tagline: hsTagline,
          category: hsCategory,
          image: hsImage,
          fallbackImage: hsFallbackImage,
          lookId: hsLookId,
          keyPieces: piecesArray,
          isActive: hsIsActive,
          order: Number(hsOrder)
        });
        showNotice('Hero slide updated');
      } else {
        await api.createHeroSlide({
          title: hsTitle,
          tagline: hsTagline,
          category: hsCategory,
          image: hsImage,
          fallbackImage: hsFallbackImage,
          lookId: hsLookId,
          keyPieces: piecesArray,
          isActive: hsIsActive,
          order: Number(hsOrder)
        });
        showNotice('New hero slide added');
      }
      setIsAddingHeroSlide(false);
      resetHeroSlideForm();
      fetchHeroSlides();
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEditHeroSlide = (slide: HeroSlide) => {
    setEditingHeroSlide(slide);
    setHsTitle(slide.title);
    setHsTagline(slide.tagline);
    setHsCategory(slide.category);
    setHsImage(slide.image);
    setHsFallbackImage(slide.fallbackImage || '');
    setHsLookId(slide.lookId || (lookbooks[0]?.id || 'look-1'));
    setHsKeyPieces((slide.keyPieces || []).join(', '));
    setHsIsActive(slide.isActive ?? true);
    setHsOrder(slide.order ?? 1);
    setIsAddingHeroSlide(true);
  };

  const resetHeroSlideForm = () => {
    setHsTitle('');
    setHsTagline('');
    setHsCategory('Autumn Essentials');
    setHsImage('/hero-1.jpg');
    setHsFallbackImage('https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=800&q=80');
    setHsLookId(lookbooks[0]?.id || 'look-1');
    setHsKeyPieces('Cable Knit Vest, Tan Loafers, Poplin Shirt');
    setHsIsActive(true);
    setHsOrder(heroSlidesList.length + 1);
    setEditingHeroSlide(null);
  };

  const handleDeleteHeroSlide = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hero slide?')) return;
    try {
      await api.deleteHeroSlide(id);
      showNotice('Hero slide deleted');
      fetchHeroSlides();
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleHeroSlideActive = async (slide: HeroSlide) => {
    try {
      await api.updateHeroSlide(slide.id, {
        isActive: !slide.isActive
      });
      showNotice(`Hero slide "${slide.title}" is now ${!slide.isActive ? 'Active' : 'Inactive'}`);
      fetchHeroSlides();
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- Handlers: Admin Security & Passcode ---
  const handleUpdateAdminPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminPin.trim().length < 4) {
      setError('Passcode must be at least 4 characters long');
      return;
    }
    if (newAdminPin !== confirmAdminPin) {
      setError('New passcode and confirmation do not match');
      return;
    }
    try {
      await api.updateAdminPin(newAdminPin.trim());
      setNewAdminPin('');
      setConfirmAdminPin('');
      showNotice('Admin passcode successfully updated');
    } catch (err: any) {
      setError(err.message);
    }
  };


  // --- Handlers: Set My Authenticator (phone app / TOTP) ---
  const handleCopySecretKey = () => {
    navigator.clipboard.writeText(authSecret);
    setCopiedKey(true);
    showNotice('Authenticator key copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleRegenerateAuthSecret = async () => {
    if (!confirm('Generate a brand-new Authenticator Secret Key? You will need to re-scan the QR code with your phone authenticator app.')) return;
    try {
      const newSecret = generateRandomSecret(32);
      await api.updateAuthenticatorConfig(newSecret, authEnabled);
      setAuthSecret(newSecret);
      const uri = generateOtpauthUri(newSecret, 'admin', 'MUIRO');
      const qr = await generateQrCodeDataUrl(uri);
      setAuthQrUrl(qr);
      showNotice('New Authenticator Key generated. Please scan the new QR code in your app.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetAuthSecret = async () => {
    if (!confirm('Reset Authenticator key to factory default?')) return;
    try {
      const cfg = await api.resetAuthenticatorConfig();
      const next = cfg.secret;
      setAuthSecret(next);
      setAuthEnabled(true);
      const uri = generateOtpauthUri(next, 'admin', 'MUIRO');
      const qr = await generateQrCodeDataUrl(uri);
      setAuthQrUrl(qr);
      showNotice('Authenticator reset to a new factory key — re-scan the QR code');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestAuthCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authTestCode.trim()) return;
    const isValid = await verifyTotpOrKey(authTestCode.trim(), authSecret);
    if (isValid) {
      setAuthTestResult('valid');
      showNotice('Authenticator code successfully verified!');
    } else {
      setAuthTestResult('invalid');
      setError('Invalid Authenticator code. Check your device clock or enter the current 6-digit rolling code.');
    }
    setTimeout(() => setAuthTestResult(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-casual">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-slate-200">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Content & Editorial Management Studio</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-slate-900">
            Owner Admin Controls
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Curate newly added & trendy clothes, shoppable lookbooks, and customer styling reviews.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onLockSession && (
            <button
              onClick={onLockSession}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 transition cursor-pointer"
              title="Lock admin session"
            >
              <Lock className="w-3.5 h-3.5 text-slate-700" />
              <span>Lock / Exit Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-8 border-b border-[#e8e2dc] overflow-x-auto">
        <button
          onClick={() => setActiveTab('lookbooks')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'lookbooks'
              ? 'border-[#181512] text-[#181512]'
              : 'border-transparent text-[#6e6761] hover:text-[#181512]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Lookbooks ({lookbooks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'products'
              ? 'border-[#181512] text-[#181512]'
              : 'border-transparent text-[#6e6761] hover:text-[#181512]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Clothes & Links ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('commerce')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'commerce'
              ? 'border-[#181512] text-[#181512]'
              : 'border-transparent text-[#6e6761] hover:text-[#181512]'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Programs & Merchants</span>
        </button>

        <button
          onClick={() => setActiveTab('testimonials')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'testimonials'
              ? 'border-[#181512] text-[#181512]'
              : 'border-transparent text-[#6e6761] hover:text-[#181512]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Testimonials ({testimonials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('herosection')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'herosection'
              ? 'border-[#181512] text-[#181512]'
              : 'border-transparent text-[#6e6761] hover:text-[#181512]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Hero Slides ({heroSlidesList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'security'
              ? 'border-[#181512] text-[#181512]'
              : 'border-transparent text-[#6e6761] hover:text-[#181512]'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Passcode & Security</span>
        </button>
      </div>

      {/* --- TAB 1: LOOKBOOKS --- */}
      {activeTab === 'lookbooks' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#181512]">Manage Aesthetic Lookbooks</h2>
              <p className="text-xs text-[#6e6761]">
                Toggle "Newly Added" and "Trending" to feature in hero & slider below.
              </p>
            </div>
            <button
              onClick={() => {
                resetLookbookForm();
                setIsAddingLookbook(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#181512] text-white hover:bg-black text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Lookbook</span>
            </button>
          </div>

          {/* Form */}
          {isAddingLookbook && (
            <form onSubmit={handleSaveLookbook} className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-md mb-8">
              <h3 className="text-lg font-bold text-[#181512] mb-4">
                {editingLookbook ? 'Edit Lookbook' : 'Create New Lookbook'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={lbTitle}
                    onChange={e => setLbTitle(e.target.value)}
                    placeholder="e.g. Autumn Essentials: Knits & Loafers"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Pinterest Board Category</label>
                  <input
                    type="text"
                    required
                    value={lbBoard}
                    onChange={e => setLbBoard(e.target.value)}
                    placeholder="e.g. Autumn Fashion | Fall Outfit Ideas"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>

             </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <ImageFieldWithUpload
                    label="Cover Image"
                    value={lbCover}
                    onChange={setLbCover}
                    required
                    hint="Paste an image URL or upload a file (stored at /uploads/… and rendered as the lookbook cover)."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Aesthetic Category</label>
                  <input
                    type="text"
                    value={lbCategory}
                    onChange={e => setLbCategory(e.target.value)}
                    placeholder="e.g. Autumn Essentials, K-Fashion Summer"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-6 items-center p-3 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl mb-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-[#181512]">
                  <input
                    type="checkbox"
                    checked={lbIsNewlyAdded}
                    onChange={e => setLbIsNewlyAdded(e.target.checked)}
                    className="w-4 h-4 rounded text-[#181512]"
                  />
                  <span>✨ Newly Added Look</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-[#181512]">
                  <input
                    type="checkbox"
                    checked={lbIsTrending}
                    onChange={e => setLbIsTrending(e.target.checked)}
                    className="w-4 h-4 rounded text-[#181512]"
                  />
                  <span>🔥 Trending Look</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-[#181512]">
                  <input
                    type="checkbox"
                    checked={lbFeatured}
                    onChange={e => setLbFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-[#181512]"
                  />
                  <span>Featured Status</span>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={lbDescription}
                  onChange={e => setLbDescription(e.target.value)}
                  placeholder="Styling description for this outfit recreation..."
                  className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                />
              </div>

              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Stylist Recommendation</label>
                <textarea
                  rows={3}
                  value={lbAuthorNote}
                  onChange={e => setLbAuthorNote(e.target.value)}
                  placeholder="A short editorial note on how to wear, layer, or finish the look..."
                  className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] resize-y"
                />
                <p className="text-[11px] text-[#8c827a] mt-1">Shown only when you add a recommendation; keep it concise and editorial.</p>
              </div>

              {/* Pieces Selector — searchable/filterable so large product catalogs remain manageable */}
              <div className="mb-5">
                <div className="flex flex-col gap-2 mb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <label className="block text-xs font-semibold uppercase text-[#6e6761]">
                      Attached Shoppable Pieces ({lbPieces.length} selected)
                    </label>
                    <span className="text-[11px] text-[#8a8179]">{filteredLookbookPieces.length} of {products.length} outfits shown</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                    <div className="relative">
                      <input
                        type="search"
                        value={lbPieceSearch}
                        onChange={e => setLbPieceSearch(e.target.value)}
                        placeholder="Search outfit/product title, merchant, category…"
                        aria-label="Search outfits for this lookbook"
                        className="w-full p-2.5 pl-3 border border-[#e8e2dc] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#181512]/10"
                      />
                    </div>
                    <select
                      value={lbPieceCategory}
                      onChange={e => setLbPieceCategory(e.target.value)}
                      aria-label="Filter outfits by category"
                      className="p-2.5 border border-[#e8e2dc] rounded-lg text-xs bg-white"
                    >
                      <option value="all">All categories</option>
                      {lookbookPieceCategories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <select
                      value={lbPieceMerchant}
                      onChange={e => setLbPieceMerchant(e.target.value)}
                      aria-label="Filter outfits by merchant"
                      className="p-2.5 border border-[#e8e2dc] rounded-lg text-xs bg-white"
                    >
                      <option value="all">All merchants</option>
                      {lookbookPieceMerchants.map(merchant => <option key={merchant} value={merchant}>{merchant}</option>)}
                    </select>
                    <select
                      value={lbPieceProgram}
                      onChange={e => setLbPieceProgram(e.target.value)}
                      aria-label="Filter outfits by affiliate program"
                      className="p-2.5 border border-[#e8e2dc] rounded-lg text-xs bg-white"
                    >
                      <option value="all">All affiliate programs</option>
                      {lookbookPiecePrograms.map(program => (
                        <option key={program.id} value={program.id}>{program.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-[#6e6761] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lbShowSelectedOnly}
                        onChange={e => setLbShowSelectedOnly(e.target.checked)}
                        className="w-4 h-4 rounded text-[#181512]"
                      />
                      <span>Show selected only</span>
                    </label>
                    {(lbPieceSearch || lbPieceCategory !== 'all' || lbPieceMerchant !== 'all' || lbPieceProgram !== 'all' || lbShowSelectedOnly) && (
                      <button
                        type="button"
                        onClick={() => { setLbPieceSearch(''); setLbPieceCategory('all'); setLbPieceMerchant('all'); setLbPieceProgram('all'); setLbShowSelectedOnly(false); }}
                        className="text-[11px] font-bold uppercase tracking-wider text-[#6e6761] hover:text-[#181512]"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-3 border border-[#e8e2dc] rounded-xl bg-[#fcfbf9]">
                  {filteredLookbookPieces.length > 0 ? filteredLookbookPieces.map(p => {
                    const isSelected = lbPieces.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setLbPieces(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                        aria-pressed={isSelected}
                        className={`p-2 rounded-lg border text-left text-xs cursor-pointer transition flex items-center gap-2 min-w-0 ${
                          isSelected ? 'border-[#181512] bg-white font-bold shadow-xs' : 'border-[#e8e2dc] text-[#6e6761] hover:border-[#bdb4ab] hover:bg-white'
                        }`}
                      >
                        <img src={p.image} alt="" className="w-9 h-9 shrink-0 rounded object-cover bg-[#f4efe9]" />
                        <span className="min-w-0">
                          <span className="block truncate">{p.title}</span>
                          <span className="block truncate text-[10px] font-normal text-[#8a8179]">{p.category}{p.merchant ? ` · ${p.merchant}` : ''}</span>
                          <span className="block truncate text-[10px] font-normal text-[#a0958c]">{p.affiliateProgramId ? (affiliatePrograms.find(program => program.id === p.affiliateProgramId)?.name || 'Affiliate program') : 'No affiliate program'}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-auto" />}
                      </button>
                    );
                  }) : (
                    <div className="col-span-full py-8 text-center text-xs text-[#8a8179]">No outfits match these filters.</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingLookbook(false)}
                  className="px-4 py-2 border border-[#e8e2dc] rounded-lg text-xs font-bold uppercase hover:bg-[#f4efe9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#181512] text-white rounded-lg text-xs font-bold uppercase hover:bg-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Lookbook</span>
                </button>
              </div>
            </form>
          )}

          {/* Lookbooks Table */}
          <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fcfbf9] border-b border-[#e8e2dc] text-[11px] font-bold uppercase text-[#6e6761]">
                  <th className="py-3 px-4">Lookbook</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status Badges</th>
                  <th className="py-3 px-4">Pieces</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2dc] text-xs">
                {lookbooks.map(look => (
                  <tr key={look.id} className="hover:bg-[#fcfbf9]/60">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <img src={look.cover} alt="" className="w-12 h-14 rounded-lg object-cover bg-[#f4efe9]" />
                      <div>
                        <div className="font-bold text-[#181512]">{look.title}</div>
                        <div className="text-[11px] text-[#6e6761]">{look.board}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#6e6761]">{look.category}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Quick Toggle: Newly Added */}
                        <button
                          onClick={() => handleToggleLookbookStatus(look, 'isNewlyAdded')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                            look.isNewlyAdded
                              ? 'bg-emerald-800 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title="Click to toggle Newly Added status"
                        >
                          {look.isNewlyAdded ? '✨ New' : '+ Set New'}
                        </button>

                        {/* Quick Toggle: Trending */}
                        <button
                          onClick={() => handleToggleLookbookStatus(look, 'isTrending')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                            look.isTrending
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title="Click to toggle Trending status"
                        >
                          {look.isTrending ? '🔥 Trending' : '+ Set Trendy'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#181512]">
                      {look.pieces?.length || 0} Pieces
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEditLookbook(look)}
                          className="p-1.5 text-[#6e6761] hover:text-[#181512] rounded hover:bg-[#f4efe9] cursor-pointer"
                          title="Edit lookbook"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLookbook(look.id)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 cursor-pointer"
                          title="Delete lookbook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: PRODUCTS (CLOTHES) & QUICK TOGGLES --- */}
      {activeTab === 'products' && (
        <div>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#181512]">
                Shoppable Clothes & Affiliate Links
              </h2>
              <p className="text-xs text-[#6e6761]">
                Quickly toggle newly added and trendy clothes directly with 1 click in the list below.
              </p>
            </div>
            <button
              onClick={() => {
                resetProductForm();
                setIsAddingProduct(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#181512] text-white hover:bg-black text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Clothing Piece</span>
            </button>
          </div>

          {/* Product Form */}
          {isAddingProduct && (
            <form onSubmit={handleSaveProduct} className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-md mb-8">
              <h3 className="text-lg font-bold text-[#181512] mb-4">
                {editingProduct ? 'Edit Clothing Item' : 'Add New Clothing Piece'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    value={pTitle}
                    onChange={e => setPTitle(e.target.value)}
                    placeholder="e.g. Classic Cable-Knit Slouchy Sweater Vest"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Brand / Merchant Partner</label>
                  <select
                    required
                    value={pMerchantId}
                    onChange={e => {
                      const merchantId = e.target.value;
                      setPMerchantId(merchantId);
                      const merchant = merchants.find(m => m.id === merchantId);
                      setPAffiliateProgramId(merchant?.affiliateProgramId || '');
                    }}
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  >
                    <option value="">Select a brand / merchant from CMS</option>
                    {merchants.map(merchant => (
                      <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#8c7b6d] mt-1">These are the actual CMS merchant/brand records. Add or edit them in <strong>Programs & Merchants</strong>.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Affiliate Program</label>
                  <select
                    required
                    value={pAffiliateProgramId}
                    onChange={e => setPAffiliateProgramId(e.target.value)}
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  >
                    <option value="">Select the actual affiliate program</option>
                    {affiliatePrograms.map(program => (
                      <option key={program.id} value={program.id}>
                        {program.name} · {program.network}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#8c7b6d] mt-1">Choose the CMS program this product uses. Merchant and program are stored separately.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <ImageFieldWithUpload
                    label="Product Image"
                    value={pImage}
                    onChange={setPImage}
                    required
                    hint="Paste an image URL or upload a file (stored at /uploads/… and rendered on the shop page)."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Affiliate Destination URL</label>
                  <input
                    type="text"
                    required
                    value={pAffiliateUrl}
                    onChange={e => setPAffiliateUrl(e.target.value)}
                    placeholder="Paste the saved merchant product URL"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Retail Price</label>
                  <input
                    type="text"
                    value={pPrice}
                    onChange={e => setPPrice(e.target.value)}
                    placeholder="e.g. $43.99 (leave blank for See retailer)"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Category</label>
                  <input
                    type="text"
                    value={pCategory}
                    onChange={e => setPCategory(e.target.value)}
                    placeholder="e.g. Dresses, Tops, Shoes"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Commission %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={pCommissionRate}
                    onChange={e => setPCommissionRate(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Product Description</label>
                <textarea
                  value={pDescription}
                  onChange={e => setPDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the piece, fit, fabric, styling notes, or key details..."
                  className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] resize-y"
                />
              </div>

              {/* Toggles for newly added and trendy */}
              <div className="flex gap-6 items-center p-3 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl mb-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-[#181512]">
                  <input
                    type="checkbox"
                    checked={pIsNewlyAdded}
                    onChange={e => setPIsNewlyAdded(e.target.checked)}
                    className="w-4 h-4 rounded text-[#181512]"
                  />
                  <span>✨ Mark as Newly Added Piece</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-[#181512]">
                  <input
                    type="checkbox"
                    checked={pIsTrending}
                    onChange={e => setPIsTrending(e.target.checked)}
                    className="w-4 h-4 rounded text-[#181512]"
                  />
                  <span>🔥 Mark as Trendy Clothes</span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingProduct(false)}
                  className="px-4 py-2 border border-[#e8e2dc] rounded-lg text-xs font-bold uppercase hover:bg-[#f4efe9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#181512] text-white rounded-lg text-xs font-bold uppercase hover:bg-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Clothing Piece</span>
                </button>
              </div>
            </form>
          )}

          {/* Products Table with Quick 1-Click Toggles */}
          <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fcfbf9] border-b border-[#e8e2dc] text-[11px] font-bold uppercase text-[#6e6761]">
                  <th className="py-3 px-4">Clothing Item</th>
                  <th className="py-3 px-4">Merchant</th>
                  <th className="py-3 px-4">Quick Status Toggles</th>
                  <th className="py-3 px-4">Total Clicks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2dc] text-xs">
                {products.map(prod => (
                  <tr key={prod.id} className="hover:bg-[#fcfbf9]/60">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <img src={prod.image} alt="" className="w-10 h-12 rounded object-cover bg-[#f4efe9]" />
                      <div>
                        <div className="font-bold text-[#181512] line-clamp-1">{prod.title}</div>
                        <div className="text-[11px] text-[#6e6761]">{prod.category}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block text-[10px] font-semibold text-[#8c7b6d]">{prod.merchant}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {/* 1-Click Toggle Newly Added */}
                        <button
                          onClick={() => handleToggleProductStatus(prod, 'isNewlyAdded')}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            prod.isNewlyAdded
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title="Click to toggle Newly Added status"
                        >
                          {prod.isNewlyAdded ? '✨ Newly Added' : '⚪ Not New'}
                        </button>

                        {/* 1-Click Toggle Trending */}
                        <button
                          onClick={() => handleToggleProductStatus(prod, 'isTrending')}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            prod.isTrending
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title="Click to toggle Trending status"
                        >
                          {prod.isTrending ? '🔥 Trendy' : '⚪ Not Trendy'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#181512]">
                      {prod.clicks || 0} clicks
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEditProduct(prod)}
                          className="p-1.5 text-[#6e6761] hover:text-[#181512] rounded hover:bg-[#f4efe9] cursor-pointer"
                          title="Edit clothing item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 cursor-pointer"
                          title="Delete piece"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 3: AFFILIATE PROGRAMS & MERCHANTS --- */}
      {activeTab === 'commerce' && (
        <AffiliateCommerceManager onChanged={() => { onRefreshData(); api.getMerchants().then(setMerchants).catch(() => {}); }} />
      )}

      {/* --- TAB 4: TESTIMONIALS --- */}
      {activeTab === 'testimonials' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#181512]">Manage Social Proof & Reviews</h2>
            <button
              onClick={() => {
                resetTestimonialForm();
                setIsAddingTestimonial(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#181512] text-white hover:bg-black text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Review</span>
            </button>
          </div>

          {/* Testimonial Form */}
          {isAddingTestimonial && (
            <form onSubmit={handleSaveTestimonial} className="bg-white p-6 rounded-2xl border border-[#e8e2dc] shadow-md mb-8">
              <h3 className="text-lg font-bold text-[#181512] mb-4">
                {editingTestimonial ? 'Edit Review' : 'Add Testimonial'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Shopper Name</label>
                  <input
                    type="text"
                    required
                    value={tAuthor}
                    onChange={e => setTAuthor(e.target.value)}
                    placeholder="e.g. Maya L."
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Outfit Title</label>
                  <input
                    type="text"
                    value={tOutfitTitle}
                    onChange={e => setTOutfitTitle(e.target.value)}
                    placeholder="e.g. Autumn Essentials"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>
              </div>

              <div className="mb-4">
                <ImageFieldWithUpload
                  label="Reviewer Avatar"
                  value={tAvatar}
                  onChange={setTAvatar}
                  hint="Paste an avatar image URL or upload a file (stored at /uploads/…)."
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">Feedback Comment</label>
                <textarea
                  rows={3}
                  required
                  value={tComment}
                  onChange={e => setTComment(e.target.value)}
                  className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingTestimonial(false)}
                  className="px-4 py-2 border border-[#e8e2dc] rounded-lg text-xs font-bold uppercase hover:bg-[#f4efe9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#181512] text-white rounded-lg text-xs font-bold uppercase hover:bg-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Review</span>
                </button>
              </div>
            </form>
          )}

          {/* Testimonials List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map(item => (
              <div key={item.id} className="bg-white p-5 rounded-2xl border border-[#e8e2dc] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex text-amber-500">
                      {[...Array(item.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Verified Buyer
                    </span>
                  </div>
                  <p className="text-sm text-[#181512] mb-3 italic">"{item.comment}"</p>
                  <div className="text-xs text-[#6e6761] mb-4">
                    Look: <strong className="text-[#181512]">{item.outfitTitle}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#e8e2dc]/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src={item.avatar} alt={item.author} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <div className="text-xs font-bold text-[#181512]">{item.author}</div>
                      <div className="text-[10px] text-[#6e6761]">{item.location}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditTestimonial(item)}
                      className="p-1.5 text-[#6e6761] hover:text-[#181512] rounded hover:bg-[#f4efe9] cursor-pointer"
                      title="Edit review"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTestimonial(item.id)}
                      className="p-1.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 cursor-pointer"
                      title="Delete review"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 4: HERO SLIDES & SHOWCASE --- */}
      {activeTab === 'herosection' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold font-display text-[#181512]">
                Hero Section Carousel Slides
              </h2>
              <p className="text-xs text-[#6e6761]">
                Control the photos, titles, tags, key pieces hotspots, and linked lookbooks displayed in the main hero swipe showcase.
              </p>
            </div>

            <button
              onClick={() => {
                if (isAddingHeroSlide) {
                  setIsAddingHeroSlide(false);
                  resetHeroSlideForm();
                } else {
                  resetHeroSlideForm();
                  setIsAddingHeroSlide(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#181512] hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingHeroSlide ? 'Cancel' : 'Add Hero Slide'}</span>
            </button>
          </div>

          {/* Add / Edit Hero Slide Form */}
          {isAddingHeroSlide && (
            <form onSubmit={handleSaveHeroSlide} className="mb-10 p-6 bg-white border border-[#e8e2dc] rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#e8e2dc]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#181512]">
                  {editingHeroSlide ? 'Edit Hero Slide' : 'Create New Hero Slide'}
                </h3>
                <span className="text-xs text-[#6e6761]">
                  Swipe & Drag supported on desktop and mobile
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                    Slide Headline / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={hsTitle}
                    onChange={e => setHsTitle(e.target.value)}
                    placeholder="e.g. Autumn Essentials & Layered Knits"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] text-[#181512] focus:outline-none focus:border-[#181512]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                    Category Tag *
                  </label>
                  <input
                    type="text"
                    required
                    value={hsCategory}
                    onChange={e => setHsCategory(e.target.value)}
                    placeholder="e.g. Fall / Autumn Edit"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] text-[#181512] focus:outline-none focus:border-[#181512]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={hsTagline}
                  onChange={e => setHsTagline(e.target.value)}
                  placeholder="e.g. Beige Cable-Knit Vest, Crisp Poplin Shirt & Tan Loafers"
                  className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] text-[#181512] focus:outline-none focus:border-[#181512]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <ImageFieldWithUpload
                    label="Hero Photo Image URL *"
                    value={hsImage}
                    onChange={setHsImage}
                    required
                    hint="The image shown on the public Hero. Paste an image URL or upload a file (stored at /uploads/…)."
                  />
                </div>

                <div>
                  <ImageFieldWithUpload
                    label="Fallback Image URL"
                    value={hsFallbackImage}
                    onChange={setHsFallbackImage}
                    hint="Used only if the primary hero photo fails to load."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                    Linked Lookbook (Opens when clicking Shop Look)
                  </label>
                  <select
                    value={hsLookId}
                    onChange={e => setHsLookId(e.target.value)}
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] text-[#181512] focus:outline-none focus:border-[#181512]"
                  >
                    {lookbooks.map(look => (
                      <option key={look.id} value={look.id}>
                        {look.title} ({look.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                    Key Pieces Hotspot Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={hsKeyPieces}
                    onChange={e => setHsKeyPieces(e.target.value)}
                    placeholder="Cable Knit Vest, Tan Loafers, Poplin Shirt"
                    className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] text-[#181512] focus:outline-none focus:border-[#181512]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="w-32">
                  <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={hsOrder}
                    onChange={e => setHsOrder(Number(e.target.value))}
                    className="w-full p-2 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9]"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-5">
                  <input
                    type="checkbox"
                    checked={hsIsActive}
                    onChange={e => setHsIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#181512]"
                  />
                  <span className="text-xs font-semibold text-[#181512]">Active in Hero Showcase</span>
                </label>
              </div>

              {/* Real-time Preview Preview Card */}
              <div className="mt-4 p-4 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6e6761] block mb-2">
                  Live Card Preview:
                </span>
                <div className="flex items-start gap-3 sm:gap-4">
                  <img
                    src={hsImage || hsFallbackImage}
                    alt="Preview"
                    className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-lg border border-[#e8e2dc] shrink-0"
                    onError={(e) => {
                      if (hsFallbackImage) (e.target as HTMLImageElement).src = hsFallbackImage;
                    }}
                  />
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-[#181512] text-white text-[10px] font-bold uppercase tracking-wider mb-1">
                      {hsCategory || 'Category'}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-[#181512] leading-snug">{hsTitle || 'Untitled Slide'}</h4>
                    <p className="text-[10px] sm:text-xs text-[#6e6761] line-clamp-1">{hsTagline || 'No subtitle provided'}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {hsKeyPieces.split(',').map((piece, i) => piece.trim() ? (
                        <span key={i} className="text-[10px] bg-white border border-[#e8e2dc] px-1.5 py-0.5 rounded text-[#181512]">
                          {piece.trim()}
                        </span>
                      ) : null)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingHeroSlide(false);
                    resetHeroSlideForm();
                  }}
                  className="px-4 py-2.5 sm:py-2 border border-[#e8e2dc] rounded-lg text-xs font-bold uppercase hover:bg-[#f4efe9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 sm:py-2 bg-[#181512] text-white rounded-lg text-xs font-bold uppercase hover:bg-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingHeroSlide ? 'Save Changes' : 'Publish Slide'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Hero Slides Grid — ordered by the persisted `order` field so the
              admin list matches the public Hero ordering */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...heroSlidesList]
              .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
              .map((slide, idx) => {
              const matchedLook = lookbooks.find(l => l.id === slide.lookId);
              return (
                <div
                  key={slide.id || idx}
                  className={`bg-white rounded-2xl border transition shadow-xs overflow-hidden flex flex-col justify-between ${
                    slide.isActive !== false ? 'border-[#e8e2dc]' : 'border-dashed border-slate-300 opacity-60'
                  }`}
                >
                  <div className="p-5 flex gap-4">
                    <div className="relative w-24 sm:w-28 aspect-[3/4] shrink-0 rounded-xl overflow-hidden bg-[#f4efe9] border border-[#e8e2dc]">
                      <img
                        src={slide.image}
                        alt={slide.title}
                        onError={(e) => {
                          if (slide.fallbackImage) {
                            (e.target as HTMLImageElement).src = slide.fallbackImage;
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 bg-[#181512]/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                        #{slide.order || idx + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#f4efe9] text-[#181512] text-[10px] font-bold uppercase tracking-wider">
                          {slide.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            slide.isActive !== false
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {slide.isActive !== false ? 'Active' : 'Hidden'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[#181512] leading-snug mb-1 line-clamp-1">
                        {slide.title}
                      </h3>
                      <p className="text-xs text-[#6e6761] line-clamp-2 mb-2">
                        {slide.tagline}
                      </p>

                      <div className="text-[11px] text-[#6e6761] mb-2">
                        Linked Look: <strong className="text-[#181512]">{matchedLook?.title || slide.lookId}</strong>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {(slide.keyPieces || []).map((piece, pIdx) => (
                          <span
                            key={pIdx}
                            className="text-[10px] font-semibold bg-white border border-[#e8e2dc] px-1.5 py-0.5 rounded text-[#181512]"
                          >
                            {piece}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-[#fcfbf9] border-t border-[#e8e2dc] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleHeroSlideActive(slide)}
                      className="text-xs font-semibold text-[#6e6761] hover:text-[#181512] cursor-pointer"
                    >
                      {slide.isActive !== false ? 'Mark as Inactive' : 'Mark as Active'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditHeroSlide(slide)}
                        className="p-1.5 text-[#6e6761] hover:text-[#181512] rounded hover:bg-[#f4efe9] cursor-pointer"
                        title="Edit Slide"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteHeroSlide(slide.id)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 cursor-pointer"
                        title="Delete Slide"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB 5: PASSCODE & SECURITY SETTINGS --- */}
      {activeTab === 'security' && (
        <div className="max-w-3xl space-y-6">
          <div>
            <h2 className="text-xl font-bold font-display text-[#181512]">
              Admin Security & Passcode Configuration
            </h2>
            <p className="text-xs text-[#6e6761]">
              Manage the master owner passcode (PIN) protecting this editorial studio and analytics.
            </p>
          </div>

          {/* Change Passcode Card */}
          <form onSubmit={handleUpdateAdminPin} className="p-6 bg-white border border-[#e8e2dc] rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e8e2dc]">
              <KeyRound className="w-4 h-4 text-[#181512]" />
              <h3 className="text-sm font-bold text-[#181512]">Update Admin Passcode</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                  New Passcode (min 4 chars) *
                </label>
                <input
                  type="password"
                  required
                  value={newAdminPin}
                  onChange={e => setNewAdminPin(e.target.value)}
                  placeholder="Enter new PIN"
                  className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] font-mono tracking-widest text-[#181512] focus:outline-none focus:border-[#181512]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#6e6761] mb-1">
                  Confirm New Passcode *
                </label>
                <input
                  type="password"
                  required
                  value={confirmAdminPin}
                  onChange={e => setConfirmAdminPin(e.target.value)}
                  placeholder="Re-enter new PIN"
                  className="w-full p-2.5 border border-[#e8e2dc] rounded-lg text-sm bg-[#fcfbf9] font-mono tracking-widest text-[#181512] focus:outline-none focus:border-[#181512]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#181512] hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Update Passcode</span>
              </button>
            </div>
          </form>

          {/* Authenticator Key (Set My Authenticator / 2FA) Setup Card */}
          <div className="p-6 bg-white border border-[#e8e2dc] rounded-2xl shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e8e2dc]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#181512] text-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#181512]">Set My Authenticator</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-[#6e6761]">
                    Pair your phone with the QR code below -- the 6-digit codes are generated on your phone only, never shown on this website.
                  </p>
                </div>
              </div>
            </div>

            {/* QR Code and Key Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left: QR Code for instant phone camera scan */}
              <div className="md:col-span-4 flex flex-col items-center p-4 bg-[#fcfbf9] border border-[#e8e2dc] rounded-2xl text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-[#181512] mb-3 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" />
                  <span>Scan with Phone</span>
                </div>

                {authQrUrl ? (
                  <div className="p-2.5 bg-white rounded-xl border border-[#e8e2dc] shadow-xs mb-3">
                    <img src={authQrUrl} alt="Authenticator QR Code" className="w-48 h-48 object-contain" />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-slate-100 rounded-xl flex items-center justify-center text-xs text-[#6e6761] mb-3">
                    Generating QR...
                  </div>
                )}

                <p className="text-[11px] text-[#6e6761] leading-relaxed">
                  Open <strong>your authenticator app</strong> (Google Authenticator, Microsoft Authenticator, 1Password, etc.) on your phone, tap <strong>+</strong>, and scan this code.
                </p>
              </div>

              {/* Right: Secret Key, Recovery Key, and Live Tester */}
              <div className="md:col-span-8 space-y-4">
                {/* Secret Key with Copy */}
                <div className="p-4 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#181512]">
                      Manual Setup Secret Key (Base32):
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySecretKey}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#181512] hover:underline cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? 'Copied to Clipboard' : 'Copy Key'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-white border border-[#e8e2dc] rounded-lg font-mono text-xs text-[#181512] tracking-wider break-all select-all font-semibold">
                    {authSecret}
                  </div>
                  <p className="text-[11px] text-[#6e6761]">
                    If unable to scan QR code, choose &quot;Enter a setup key&quot; in your authenticator app and paste the key above. Account: <code className="font-bold text-[#181512]">admin</code>, Issuer: <code className="font-bold text-[#181512]">MUIRO</code>.
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* Quick FAQ / Reset Guide */}
          <div className="p-6 bg-[#fcfbf9] border border-[#e8e2dc] rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#181512]">
              <HelpCircle className="w-4 h-4 text-[#181512]" />
              <span>How to Reset the Admin Password or Unlock with Authenticator</span>
            </div>
            <ul className="text-xs text-[#6e6761] space-y-2 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-[#181512]">Unlock with Authenticator:</strong> In the login modal, switch to <strong className="text-[#181512]">&quot;Authenticator&quot;</strong> and type the 6-digit code currently shown in your phone&apos;s authenticator app. Your saved passcode still works too.
              </li>
              <li>
                <strong className="text-[#181512]">Step 1:</strong> On any device or browser, double-click or double-tap the <code className="font-bold text-[#181512]">MUIRO</code> logo in the top navigation and keep holding for 6 seconds.
              </li>
              <li>
                <strong className="text-[#181512]">Step 2:</strong> When the unlock prompt appears, click <strong className="text-[#181512]">&quot;Forgot Passcode?&quot;</strong>.
              </li>
              <li>
                <strong className="text-[#181512]">Step 3:</strong> Enter the 6-digit code from your phone authenticator app, then type a new passcode — or simply click <strong className="text-[#181512]">&quot;Show PIN&quot;</strong> on this Security tab to choose a new passcode without exposing the old one.
              </li>
              <li>
                <strong className="text-[#181512]">Locked out?</strong> On the reset screen, enter a 6-digit code from your Authenticator app to choose a new passcode. If MUIRO_MASTER_KEY is configured, it works <em>only</em> on that reset screen — it is not a login credential, and the old factory reset shortcuts are no longer accepted anywhere.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
