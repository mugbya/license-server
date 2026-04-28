import { useState } from 'react'
import { Key, BarChart3, LogOut, Copy, Check, Plus, RefreshCw } from 'lucide-react'

interface DashboardProps {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'generate' | 'stats'>('generate')
  const [licenseType, setLicenseType] = useState<'year' | 'permanent'>('year')
  const [generatedKey, setGeneratedKey] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [error, setError] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const generateKey = async () => {
    setIsGenerating(true)
    setError('')
    setGeneratedKey('')

    try {
      const prefix = licenseType === 'year' ? 'GLY' : 'GLP'
      const randomPart = () => Math.random().toString(36).substring(2, 6).toUpperCase()
      const newKey = `${prefix}-${randomPart()}-${randomPart()}-${randomPart()}-${randomPart()}`

      const res = await fetch('/api/license/create_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ license_key: newKey, license_type: licenseType })
      })

      if (res.ok) {
        setGeneratedKey(newKey)
      } else {
        const data = await res.json()
        setError(data.detail || '生成失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadStats = async () => {
    setIsLoadingStats(true)
    setError('')

    try {
      const res = await fetch('/api/license/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      })

      if (res.ok) {
        const data = await res.json()
        setStats(data.data)
      } else {
        setError('获取统计失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setIsLoadingStats(false)
    }
  }

  const changePassword = async () => {
    setPasswordError('')

    try {
      const res = await fetch('/api/admin/change_password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      })

      if (res.ok) {
        setShowPasswordModal(false)
        setCurrentPassword('')
        setNewPassword('')
        alert('密码修改成功')
      } else {
        const data = await res.json()
        setPasswordError(data.error || '修改失败')
      }
    } catch (err) {
      setPasswordError('网络错误')
    }
  }

  return (
    <div style={styles.container}>
      {/* 侧边栏 */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <Key size={28} color="white" />
          <span style={{ color: 'white', fontSize: '18px', fontWeight: 600 }}>授权管理</span>
        </div>

        <nav style={styles.nav}>
          <button
            onClick={() => setActiveTab('generate')}
            style={{
              ...styles.navItem,
              backgroundColor: activeTab === 'generate' ? 'white' : 'transparent',
              color: activeTab === 'generate' ? '#667eea' : 'white'
            }}
          >
            <Plus size={20} />
            <span>生成序列码</span>
          </button>
          <button
            onClick={() => { setActiveTab('stats'); loadStats(); }}
            style={{
              ...styles.navItem,
              backgroundColor: activeTab === 'stats' ? 'white' : 'transparent',
              color: activeTab === 'stats' ? '#667eea' : 'white'
            }}
          >
            <BarChart3 size={20} />
            <span>使用统计</span>
          </button>
        </nav>

        <div style={styles.bottom}>
          <button
            onClick={() => setShowPasswordModal(true)}
            style={styles.navItem}
          >
            <span>修改密码</span>
          </button>
          <button
            onClick={onLogout}
            style={styles.navItem}
          >
            <LogOut size={20} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main style={styles.main}>
        {activeTab === 'generate' && (
          <div style={styles.content}>
            <h2 style={styles.pageTitle}>生成序列码</h2>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>授权类型</h3>
              </div>
              <div style={styles.cardContent}>
                <div style={styles.typeSelector}>
                  <button
                    onClick={() => setLicenseType('year')}
                    style={{
                      ...styles.typeButton,
                      backgroundColor: licenseType === 'year' ? '#667eea' : '#f5f5f5',
                      color: licenseType === 'year' ? 'white' : '#333'
                    }}
                  >
                    年度授权
                  </button>
                  <button
                    onClick={() => setLicenseType('permanent')}
                    style={{
                      ...styles.typeButton,
                      backgroundColor: licenseType === 'permanent' ? '#667eea' : '#f5f5f5',
                      color: licenseType === 'permanent' ? 'white' : '#333'
                    }}
                  >
                    永久授权
                  </button>
                </div>

                <button
                  onClick={generateKey}
                  disabled={isGenerating}
                  style={styles.generateButton}
                >
                  {isGenerating ? <RefreshCw size={20} className="spin" /> : <Plus size={20} />}
                  <span>{isGenerating ? '生成中...' : '生成序列码'}</span>
                </button>

                {error && (
                  <div style={styles.error}>{error}</div>
                )}

                {generatedKey && (
                  <div style={styles.resultBox}>
                    <div style={styles.resultLabel}>生成的序列码：</div>
                    <div style={styles.resultKey}>
                      <code>{generatedKey}</code>
                      <button onClick={copyKey} style={styles.copyButton}>
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        <span>{copied ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                    <div style={styles.resultHint}>
                      {licenseType === 'year' ? '年度授权，自发放日起1年内有效' : '永久授权，无有效期限制'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div style={styles.content}>
            <h2 style={styles.pageTitle}>使用统计</h2>

            {error && <div style={styles.error}>{error}</div>}

            {isLoadingStats ? (
              <div style={styles.loading}>加载中...</div>
            ) : stats ? (
              <>
                {/* 概览卡片 */}
                <div style={styles.statsGrid}>
                  <div style={styles.statCard}>
                    <div style={styles.statValue}>{stats.total_reports || 0}</div>
                    <div style={styles.statLabel}>总上报次数</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statValue}>{stats.reports_by_date?.length || 0}</div>
                    <div style={styles.statLabel}>活跃天数</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statValue}>{stats.reports_by_country?.length || 0}</div>
                    <div style={styles.statLabel}>覆盖国家</div>
                  </div>
                </div>

                {/* 按国家统计 */}
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>按国家/地区统计</h3>
                  </div>
                  <div style={styles.cardContent}>
                    {stats.reports_by_country?.length > 0 ? (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>国家/地区</th>
                            <th style={styles.th}>数量</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.reports_by_country.map((item: any, index: number) => (
                            <tr key={index} style={styles.tr}>
                              <td style={styles.td}>{item.country || '未知'}</td>
                              <td style={styles.td}>{item.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={styles.empty}>暂无数据</div>
                    )}
                  </div>
                </div>

                {/* 最近上报记录 */}
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>最近上报记录</h3>
                  </div>
                  <div style={styles.cardContent}>
                    {stats.recent_reports?.length > 0 ? (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>版本</th>
                            <th style={styles.th}>操作系统</th>
                            <th style={styles.th}>IP</th>
                            <th style={styles.th}>位置</th>
                            <th style={styles.th}>日期</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recent_reports.slice(0, 20).map((report: any, index: number) => (
                            <tr key={index} style={styles.tr}>
                              <td style={styles.td}>{report.app_version || '-'}</td>
                              <td style={styles.td}>{report.os_name || '-'}</td>
                              <td style={styles.td}>{report.public_ip || '-'}</td>
                              <td style={styles.td}>{[report.country, report.region, report.city].filter(Boolean).join(' ') || '-'}</td>
                              <td style={styles.td}>{report.report_date || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={styles.empty}>暂无数据</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.empty}>点击"使用统计"加载数据</div>
            )}
          </div>
        )}
      </main>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>修改密码</h3>
            <div style={styles.modalContent}>
              <input
                type="password"
                placeholder="当前密码"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={styles.modalInput}
              />
              <input
                type="password"
                placeholder="新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.modalInput}
              />
              {passwordError && <div style={styles.error}>{passwordError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowPasswordModal(false)} style={styles.cancelButton}>取消</button>
              <button onClick={changePassword} style={styles.confirmButton}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh'
  },
  sidebar: {
    width: '240px',
    background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '40px',
    padding: '10px'
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    width: '100%',
    background: 'transparent',
    color: 'white'
  },
  bottom: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderTop: '1px solid rgba(255,255,255,0.2)',
    paddingTop: '20px'
  },
  main: {
    flex: 1,
    padding: '40px',
    overflowY: 'auto'
  },
  content: {
    maxWidth: '800px'
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '30px',
    color: '#333'
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: '24px'
  },
  cardHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #f0f0f0'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#333'
  },
  cardContent: {
    padding: '24px'
  },
  typeSelector: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  },
  typeButton: {
    flex: 1,
    padding: '16px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  generateButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  error: {
    padding: '12px 16px',
    background: '#fff5f5',
    color: '#e53e3e',
    borderRadius: '8px',
    fontSize: '14px',
    marginTop: '16px'
  },
  resultBox: {
    marginTop: '24px',
    padding: '20px',
    background: '#f8f9ff',
    borderRadius: '10px',
    border: '1px solid #e8ecff'
  },
  resultLabel: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '12px'
  },
  resultKey: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    background: 'white',
    padding: '16px 20px',
    borderRadius: '8px',
    border: '1px solid #ddd'
  },
  copyButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  resultHint: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#888'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '24px'
  },
  statCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#667eea'
  },
  statLabel: {
    fontSize: '14px',
    color: '#888',
    marginTop: '8px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px 8px',
    fontSize: '13px',
    color: '#888',
    fontWeight: 500,
    borderBottom: '1px solid #f0f0f0'
  },
  tr: {
    borderBottom: '1px solid #f5f5f5'
  },
  td: {
    padding: '12px 8px',
    fontSize: '14px',
    color: '#333'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#888'
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    color: '#888',
    fontSize: '14px'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'white',
    borderRadius: '16px',
    width: '400px',
    overflow: 'hidden'
  },
  modalTitle: {
    padding: '20px 24px',
    fontSize: '18px',
    fontWeight: 600,
    borderBottom: '1px solid #f0f0f0'
  },
  modalContent: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  modalInput: {
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px'
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  cancelButton: {
    padding: '10px 20px',
    background: '#f5f5f5',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  confirmButton: {
    padding: '10px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  }
}