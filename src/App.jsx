import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import FlappyBird from './FlappyBird.jsx'
import {
  ArrowLeft, ArrowRight, Bell, Bookmark, Check, ChevronDown, CircleHelp,
  Flame, Heart, Home, LockKeyhole, LogOut, Menu, MessageCircle, Moon,
  Plus, Search, Shield, Sparkles, X, Zap,
} from 'lucide-react'

const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL
    && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
)
const AppContext = createContext(null)
const AuthContext = createContext(null)

const categories = ['All', 'Relationships', 'Life', 'Confessions', 'Work', 'Family', 'Dreams']

function formatPostTime(age) {
  if (age < 1) return 'just now'
  if (age < 60) return `${age} min ago`
  const hours = Math.floor(age / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const navItems = [
  { to: '/feed', label: 'The feed', icon: Home },
  { to: '/trending', label: 'Trending', icon: Flame },
  { to: '/bookmarks', label: 'Saved', icon: Bookmark },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
]

function App() {
  const [posts, setPosts] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [session, setSession] = useState(null)
  const [supabaseClient, setSupabaseClient] = useState(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState('')
  const openComposer = () => setModalOpen(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured. Add the project URL and publishable key to .env.local.')
      setAuthLoading(false)
      return
    }

    let active = true
    let subscription
    async function initializeAuth() {
      try {
        const { supabase: client } = await import('./supabase.js')
        if (!active) return
        if (!client) throw new Error('Supabase client could not be created.')
        setSupabaseClient(client)
        const { data, error } = await client.auth.getSession()
        if (error) throw error
        if (!active) return
        setSession(data.session)
        setAuthLoading(false)
        const { data: listener } = client.auth.onAuthStateChange((_event, currentSession) => {
          setSession(currentSession)
          setAuthLoading(false)
          setAuthError('')
        })
        subscription = listener.subscription
      } catch (error) {
        if (!active) return
        setAuthError(`Could not connect to Supabase: ${error.message}`)
        setAuthLoading(false)
      }
    }
    initializeAuth()
    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session || !supabaseClient) {
      setPosts([])
      setFeedLoading(false)
      return undefined
    }

    let active = true
    setFeedLoading(true)
    setFeedError('')
    async function loadConfessions() {
      try {
        const { data, error } = await supabaseClient
          .from('confessions')
          .select('id, content, category, created_at, likes')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        if (!active) return

        setPosts((data ?? []).map(mapConfession))
      } catch (error) {
        if (active) setFeedError(`Could not load confessions from Supabase: ${error.message}`)
      } finally {
        if (active) setFeedLoading(false)
      }
    }

    loadConfessions()
    return () => { active = false }
  }, [session?.user.id, supabaseClient])

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const createPost = async (text, category) => {
    if (!supabaseClient || !session) throw new Error('Sign in before sharing a confession.')
    const { data, error } = await supabaseClient
      .from('confessions')
      .insert({ content: text, category, author_id: session.user.id })
      .select('id, content, category, created_at, likes')
      .single()
    if (error) throw error
    setPosts((items) => [mapConfession(data), ...items])
    setModalOpen(false)
    notify('Your confession is out there. You’re safe here.')
  }

  return (
    <AuthContext.Provider value={{ session, authLoading, authError, supabase: supabaseClient }}>
      <AppContext.Provider value={{
        posts, session, feedLoading, feedError, createPost,
        onLike: () => {}, onBookmark: () => {}, onReact: () => {}, onComment: () => {},
      }}>
        <Routes>
          <Route path="/" element={<FlappyBird />} />
          <Route path="/community" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell openComposer={openComposer} />}>
              <Route path="/feed" element={<FeedPage openComposer={openComposer} />} />
              <Route path="/trending" element={<FeedPage openComposer={openComposer} trending />} />
              <Route path="/bookmarks" element={<FeedPage openComposer={openComposer} saved />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile/:handle" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<FlappyBird />} />
        </Routes>
        <ConfessionModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createPost} />
        <AnimatePresence>
          {toast && <motion.div className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><Check size={16} />{toast}</motion.div>}
        </AnimatePresence>
      </AppContext.Provider>
    </AuthContext.Provider>
  )
}

function mapConfession(confession) {
  const createdAt = new Date(confession.created_at)
  const age = Number.isNaN(createdAt.getTime())
    ? 0
    : Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60_000))
  return {
    id: String(confession.id),
    name: 'anonymous soul',
    time: formatPostTime(age),
    category: confession.category || 'Confessions',
    text: confession.content,
    likes: Number(confession.likes) || 0,
    comments: [],
    reactions: {},
    bookmarked: false,
    age,
  }
}

function RequireAuth() {
  const { session, authLoading } = useAuth()
  const location = useLocation()
  if (authLoading) return <AuthLoading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function AuthLoading() {
  return <main className="auth-page"><div className="auth-card"><Brand /><p>Checking your quiet corner...</p></div></main>
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('Authentication must be used inside AuthContext')
  return context
}

function Brand({ compact = false }) {
  return <Link to="/" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="AfterHours home">
    <span className="brand-mark"><Moon size={18} fill="currentColor" /></span>
    <span>after<span className="brand-light">hours</span></span>
  </Link>
}

function Landing() {
  const navigate = useNavigate()
  const { session } = useAuth()
  return (
    <main className="landing">
      <nav className="landing-nav wrap">
        <Brand />
        <div className="landing-nav-actions">{session ? <Link to="/feed" className="quiet-link">Open the feed</Link> : <><Link to="/login" className="quiet-link">Log in</Link><Link to="/signup" className="button button-small">Find your people <ArrowRight size={15} /></Link></>}</div>
      </nav>
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> YOUR AFTER-HOURS SAFE SPACE</div>
          <h1>Some things are<br />easier <span>in the dark.</span></h1>
          <p className="hero-subtitle">A quieter corner of the internet to say the things you can’t say anywhere else. No names. No judgment. Just us.</p>
          <div className="hero-actions"><button className="button" onClick={() => navigate(session ? '/feed' : '/signup')}>{session ? 'Open your feed' : 'Find your quiet corner'} <ArrowRight size={16} /></button></div>
          <div className="hero-note"><LockKeyhole size={13} /> Anonymous by nature. Safe by design.</div>
        </div>
        <div className="hero-art" aria-label="A quiet moonlit illustration">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <motion.div className="floating-star star-a" animate={{ y: [0, -9, 0], opacity: [.5, 1, .5] }} transition={{ duration: 4, repeat: Infinity }}>✦</motion.div>
          <motion.div className="floating-star star-b" animate={{ y: [0, 7, 0], opacity: [.6, 1, .6] }} transition={{ duration: 3.2, repeat: Infinity }}>✧</motion.div>
          <div className="moon-illustration"><Moon size={82} strokeWidth={1} /><Sparkles className="moon-sparkle sparkle-one" size={19} /><Sparkles className="moon-sparkle sparkle-two" size={14} /><span>Your words.<br /><b>Your pace.</b></span></div>
          <div className="floating-tag"><LockKeyhole size={12} /> Anonymous by nature.</div>
        </div>
      </section>
      <section className="landing-bottom wrap">
        <span>MADE FOR THE THOUGHTS THAT COME AFTER DARK</span><div><span><Shield size={14} /> No profiles to perform</span><span><Heart size={14} /> Kindness is the only rule</span><span><Moon size={14} /> Here whenever you need</span></div>
      </section>
    </main>
  )
}

function AppShell({ openComposer }) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const { session, supabase } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      window.alert(`Could not sign out: ${error.message}`)
      return
    }
    navigate('/login')
  }
  return (
    <div className="app-backdrop">
      <div className="app-layout">
        <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
          <div className="sidebar-brand"><Brand compact /><button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={19} /></button></div>
          <div className="sidebar-label">YOUR SPACE</div>
          <nav className="side-nav">
            {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileMenu(false)} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}
          </nav>
          <button className="side-compose" onClick={openComposer}><Plus size={17} /> Let it out</button>
          <div className="sidebar-bottom">
            <div className="mood-card"><div className="mood-moon">☾</div><span>It’s okay to<br /><b>not be okay.</b></span><Sparkles size={16} /></div>
            <NavLink to="/profile/you" className="profile-link"><span className="profile-avatar">✧</span><span><b>your quiet corner</b><small>{session?.user.email}</small></span><ChevronDown size={15} /></NavLink>
            <button className="signout-link" onClick={signOut}><LogOut size={14} /> Sign out</button>
          </div>
        </aside>
        {mobileMenu && <button className="sidebar-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}
        <main className="main-column">
          <header className="mobile-header"><button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20} /></button><Brand compact /><Link to="/notifications" className="icon-button" aria-label="Notifications"><Bell size={19} /></Link></header>
          <div className="main-scroll"><Outlet /></div>
        </main>
        <aside className="right-column"><RightSidebar openComposer={openComposer} /></aside>
      </div>
      <nav className="mobile-bottom-nav">{navItems.slice(0, 4).map(({ to, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}><span className="mobile-icon-wrap"><Icon size={19} /></span></NavLink>)}<button className="mobile-add" onClick={openComposer}><Plus size={21} /></button></nav>
    </div>
  )
}

function Feed({ posts, onLike, onBookmark, onReact, onComment, onCompose, loading = false, error = '', trending = false, saved = false }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState(trending ? 'Trending' : 'Latest')
  const searchRef = useRef(null)
  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])
  const filtered = useMemo(() => {
    const matched = posts.filter((post) => (category === 'All' || post.category === category)
      && (!query || `${post.text} ${post.category} ${post.name}`.toLowerCase().includes(query.toLowerCase())))
    return sort === 'Trending' ? [...matched].sort((a, b) => b.likes - a.likes) : [...matched].sort((a, b) => a.age - b.age)
  }, [posts, category, query, sort])
  return (
    <>
      <div className="feed-header">
        <div><div className="eyebrow feed-eyebrow"><span className="live-dot" /> YOUR LITTLE CORNER OF THE INTERNET</div><h1>{saved ? 'Kept close.' : trending ? 'The late-night thoughts.' : 'Good evening, stranger.'}</h1><p>{saved ? 'A private little collection, just for you.' : trending ? 'The words finding their way to the most hearts.' : 'Whatever’s on your mind, there’s room for it here.'}</p></div>
        <Link className="icon-button header-bell" aria-label="Notifications" to="/notifications"><Bell size={19} /><i /></Link>
      </div>
      {error && <div className="feed-error" role="alert">{error}</div>}
      <div className="feed-search"><Search size={17} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search thoughts, feelings, words..." /><kbd>⌘ K</kbd></div>
      <div className="category-row">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`category-chip ${category === item ? 'selected' : ''}`}>{item}</button>)}</div>
      <div className="feed-controls"><div className="feed-tabs"><button onClick={() => setSort('Latest')} className={sort === 'Latest' ? 'selected' : ''}><Zap size={14} /> Latest</button><button onClick={() => setSort('Trending')} className={sort === 'Trending' ? 'selected' : ''}><Flame size={14} /> Trending</button></div><span className="feed-count">{filtered.length} {filtered.length === 1 ? 'thought' : 'thoughts'} in the open</span></div>
      <button className="composer-prompt" onClick={onCompose}><span className="prompt-icon"><Moon size={17} /></span><span>Something on your mind? <b>Let it out...</b></span><span className="prompt-enter">↵</span></button>
      <div className="post-list">
        {loading ? <div className="empty-state"><span>☾</span><h3>Listening for confessions...</h3><p>Connecting to your AfterHours feed.</p></div> : filtered.length ? filtered.map((post, index) => <PostCard key={post.id} post={post} onLike={onLike} onBookmark={onBookmark} onReact={onReact} onComment={onComment} index={index} />) : <div className="empty-state"><span>☾</span><h3>{saved ? 'Nothing tucked away yet.' : 'It’s quiet here.'}</h3><p>{saved ? 'Tap the bookmark on a confession to keep it close.' : 'Try another search or category. The right words are out there.'}</p></div>}
      </div>
      <div className="end-note"><span>✦</span> You’ve made it to the present moment <span>✦</span></div>
    </>
  )
}

function FeedPage({ openComposer, trending = false, saved = false }) {
  const { pathname } = useLocation()
  const posts = useAppPosts()
  return <Feed posts={posts.posts.filter((post) => !saved || post.bookmarked)} onLike={posts.onLike} onBookmark={posts.onBookmark} onReact={posts.onReact} onComment={posts.onComment} onCompose={openComposer} loading={posts.feedLoading} error={posts.feedError} trending={trending || pathname === '/trending'} saved={saved || pathname === '/bookmarks'} />
}

function useAppPosts() {
  const context = useContext(AppContext)
  if (!context) throw new Error('App data must be used inside AppContext')
  return context
}

function PostCard({ post, onLike, onBookmark, onReact, onComment, index = 0 }) {
  return (
    <motion.article className="post-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .055, .2) }}>
      <div className="post-top"><div className="anon-avatar post-avatar">{post.name === 'you, anonymously' ? '✧' : ['☾', '✿', '☁', '✦'][index % 4]}</div><div className="post-author"><b>{post.name}</b><span>{post.time} <i>·</i> <span className="post-category">{post.category}</span></span></div><span className="anonymous-pill"><LockKeyhole size={11} /> anonymous</span></div>
      <p className="post-text">{post.text}</p>
      {Object.keys(post.reactions).length > 0 && <div className="post-reactions">{Object.entries(post.reactions).map(([emoji, count]) => <span key={emoji} className="reaction-pill"><span>{emoji}</span>{count}</span>)}</div>}
      <div className="post-actions"><div><span className="post-action like-action" title="Likes are read from the database"><Heart size={17} />{post.likes}</span><button className="post-action" disabled title="Comments are not connected yet"><MessageCircle size={17} />0 <span>whispers</span></button></div><button className="bookmark-button" disabled aria-label="Bookmarks are not connected yet" title="Bookmarks are not connected yet"><Bookmark size={17} /></button></div>
    </motion.article>
  )
}

function RightSidebar({ openComposer }) {
  const { posts } = useAppPosts()
  const popular = [...posts].sort((a, b) => b.likes - a.likes).slice(0, 3)
  return <div className="right-inner">
    <div className="right-top"><span><span className="live-dot" /> THE NIGHT SHIFT</span><button aria-label="Help"><CircleHelp size={17} /></button></div>
    <div className="daily-card"><div className="daily-orb">☾</div><div className="daily-label">A LITTLE REMINDER</div><p>Your words belong to <em>you.</em></p><span className="daily-byline">No names. No judgment. <span>✦</span></span></div>
    <section className="right-section"><div className="section-heading"><h3><Flame size={16} /> Finding its way</h3><Link to="/trending">See all</Link></div>{popular.length ? popular.map((post, index) => <Link to="/trending" className="trending-item" key={post.id}><span className="trend-num">0{index + 1}</span><span className="trend-copy"><b>{post.text.slice(0, 34)}{post.text.length > 34 ? '…' : ''}</b><small>{post.likes} kind moments · {post.category}</small></span><ArrowUpRight /></Link>) : <p className="sidebar-empty">No confessions yet. Yours can be the first.</p>}</section>
    <div className="soft-card"><div className="soft-icon"><Heart size={17} /></div><div><b>Keep this place soft.</b><p>Leave the judgment at the door. We’re all figuring it out.</p></div></div>
    <button className="right-compose" onClick={openComposer}><Plus size={16} /> Write a confession <ArrowRight size={15} /></button>
    <footer className="right-footer"><span>About</span><span>Community guidelines</span><span>Privacy</span><small>© 2025 AfterHours · Made for the in-between.</small></footer>
  </div>
}

function ArrowUpRight() { return <ArrowRight className="trend-arrow" size={14} /> }

function ConfessionModal({ open, onClose, onSubmit }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('Confessions')
  const [openCategories, setOpenCategories] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(text.trim(), category)
      setText('')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }
  return <AnimatePresence>{open && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><motion.form className="confession-modal" onSubmit={submit} initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}><div className="modal-head"><div><span className="modal-spark">✦</span><h2>Let it out.</h2><p>No names, no judgment. Just you.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="anonymous-note"><LockKeyhole size={14} /><span>Posting as <b>completely anonymous</b></span><span className="safe-check"><Check size={13} /></span></div><textarea autoFocus maxLength={700} value={text} onChange={(event) => setText(event.target.value)} placeholder="What’s on your mind tonight? This is a safe place to put it down..." /><div className="modal-form-bottom"><div className="category-select-wrap"><button type="button" className="category-select" onClick={() => setOpenCategories((value) => !value)}><span className="select-dot" />{category}<ChevronDown size={14} /></button>{openCategories && <div className="category-options">{categories.slice(1).map((item) => <button key={item} type="button" onClick={() => { setCategory(item); setOpenCategories(false) }}>{item}</button>)}</div>}</div><span className="char-count">{text.length}/700</span></div>{error && <p className="auth-error" role="alert">{error}</p>}<div className="modal-footer"><span><Shield size={14} /> Your identity stays yours.</span><button className="button" disabled={!text.trim() || busy} type="submit">{busy ? 'Saving...' : 'Release it'} <ArrowRight size={15} /></button></div></motion.form></motion.div>}</AnimatePresence>
}

function NotificationsPage() {
  return <NotificationsContent />
}

function NotificationsContent() {
  return <div className="simple-page"><div className="eyebrow feed-eyebrow"><span className="live-dot" /> YOUR QUIET CORNER</div><div className="simple-page-heading"><div><h1>Little echoes.</h1><p>Notifications will appear here when someone responds to your thoughts.</p></div></div><div className="empty-state"><span>☾</span><h3>No notifications yet.</h3><p>When your words find someone, you’ll see it here.</p></div></div>
}

function ProfilePage() {
  const { handle } = useParams()
  return <ProfileContent handle={handle} />
}

function ProfileContent({ handle = 'you' }) {
  const isMine = handle === 'you'
  return <div className="profile-page"><div className="profile-cover"><span>✦</span><span>☾</span><span>✧</span></div><div className="profile-summary"><div className="large-avatar">☾</div><div className="profile-heading"><div><h1>{isMine ? 'Your quiet corner' : 'Anonymous profile'}</h1><span className="anonymous-pill"><LockKeyhole size={11} /> private by nature</span></div></div><p className="profile-bio">Confessions are anonymous and aren’t attached to public profiles.</p></div><div className="profile-posts-heading"><h2>About anonymity</h2><span>Private by design</span></div><div className="soft-card"><div className="soft-icon"><LockKeyhole size={17} /></div><div><b>Your words stay anonymous.</b><p>Confessions are shared in the feed without showing which account wrote them.</p></div></div></div>
}

function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const { session, authLoading, authError, supabase } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  if (!authLoading && session) return <Navigate to="/feed" replace />
  const submit = async (event) => {
    event.preventDefault()
    if (!supabase) {
      setError(authError || 'Supabase is not configured.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({ email, password })
        if (signupError) throw signupError
        if (data.session) navigate('/feed', { replace: true })
        else setMessage('Check your email for a confirmation link. Your account will be ready once you confirm it.')
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (loginError) throw loginError
        navigate(location.state?.from || '/feed', { replace: true })
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth-page"><div className="auth-glow" /><Link to="/" className="auth-back"><ArrowLeft size={16} /> Back to the quiet</Link><div className="auth-card"><Brand /><div className="auth-icon">☾</div><h1>{isSignup ? 'A little space for you.' : 'Welcome back, stranger.'}</h1><p>{isSignup ? 'Come as you are. Leave the names behind.' : 'Your quiet corner is right where you left it.'}</p><form onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@somewhere.com" /></label><label>Password<input name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength="6" required placeholder="At least 6 little characters" /></label><button className="button auth-submit" type="submit" disabled={busy || authLoading}>{busy ? 'One moment...' : isSignup ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button></form>{(error || authError) && <p className="auth-error" role="alert">{error || authError}</p>}{message && <p className="auth-success" role="status">{message}</p>}<div className="auth-disclaimer"><LockKeyhole size={13} /> Your confessions are anonymous, always.</div><div className="auth-switch">{isSignup ? 'Already have a little corner?' : 'New to the night shift?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link></div></div><span className="auth-footer"><Moon size={12} /> Made for the thoughts that come after dark.</span></main>
}

export default App
