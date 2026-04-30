import { useState, useEffect, useRef } from 'react'
import { Key, AlertCircle, Eye, EyeOff, User, X } from 'lucide-react'

// SHA256 hash function for password protection
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

interface LoginPageProps {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState<{ username: string; password: string }[]>([])
  const savedAccountsRef = useRef<{ username: string; password: string }[]>([])

  // 加载保存的账号
  useEffect(() => {
    const saved = localStorage.getItem('saved_admin_accounts')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSavedAccounts(parsed)
        savedAccountsRef.current = parsed
      } catch (e) {
        console.error('解析保存的账号失败:', e)
      }
    }
  }, [])

  // 保存账号到 localStorage
  const saveAccount = (username: string, password: string) => {
    const currentAccounts = savedAccountsRef.current
    const exists = currentAccounts.some(acc => acc.username === username)
    console.log('saveAccount called:', { username, currentAccounts, exists })
    if (!exists) {
      const newAccounts = [...currentAccounts, { username, password }]
      savedAccountsRef.current = newAccounts
      setSavedAccounts(newAccounts)
      localStorage.setItem('saved_admin_accounts', JSON.stringify(newAccounts))
      console.log('Account saved:', newAccounts)
    }
  }

  // 清除所有保存的账号（仅供测试用）
  const clearAllAccounts = () => {
    savedAccountsRef.current = []
    setSavedAccounts([])
    localStorage.removeItem('saved_admin_accounts')
  }

  // 删除保存的账号
  const deleteAccount = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newAccounts = savedAccountsRef.current.filter((_, i) => i !== index)
    savedAccountsRef.current = newAccounts
    setSavedAccounts(newAccounts)
    localStorage.setItem('saved_admin_accounts', JSON.stringify(newAccounts))
  }

  // 选择保存的账号
  const selectAccount = (acc: { username: string; password: string }) => {
    setUsername(acc.username)
    setPassword(acc.password)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Hash password before sending for security
      const hashedPassword = await sha256(password)

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: hashedPassword })
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('admin_token', data.token)
        // 自动保存账号
        if (username && password) {
          saveAccount(username, password)
        }
        onLogin()
      } else {
        const data = await res.json()
        setError(data.error || '登录失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <Key size={40} color="#333" />
          <h1 style={styles.title}>授权管理系统</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="请输入用户名"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>密码</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 保存的账号列表 */}
          {savedAccounts.length > 0 && (
            <div style={styles.savedAccounts}>
              <label style={styles.label}>保存的账号</label>
              {savedAccounts.map((acc, index) => (
                <div
                  key={index}
                  style={styles.savedAccountItem}
                  onClick={() => selectAccount(acc)}
                >
                  <User size={16} style={{ color: '#667eea' }} />
                  <span style={styles.accountName}>{acc.username}</span>
                  <button
                    type="button"
                    onClick={(e) => deleteAccount(index, e)}
                    style={styles.deleteButton}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={clearAllAccounts} style={styles.clearButton}>
                清除所有已保存账号
              </button>
            </div>
          )}

          {error && (
            <div style={styles.error}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" style={styles.button} disabled={isLoading}>
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    width: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '32px',
    gap: '12px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#333'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    color: '#666',
    fontWeight: 500
  },
  input: {
    padding: '12px 16px',
    paddingRight: '40px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'border-color 0.2s',
    backgroundColor: '#fafafa',
    width: '100%',
    boxSizing: 'border-box'
  },
  eyeButton: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#999',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  savedAccounts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  savedAccountItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: '#f8f8f8',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  accountName: {
    flex: 1,
    fontSize: '14px',
    color: '#333'
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#999',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  clearButton: {
    marginTop: '8px',
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '12px',
    color: '#999',
    cursor: 'pointer'
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#e53e3e',
    fontSize: '14px',
    padding: '12px',
    background: '#fff5f5',
    borderRadius: '8px'
  },
  button: {
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  }
}
