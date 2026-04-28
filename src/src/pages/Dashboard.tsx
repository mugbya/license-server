import { useState, useEffect } from 'react'
import { Key, BarChart3, LogOut, Copy, Check, Plus, RefreshCw, Folder, Edit2, Trash2, X } from 'lucide-react'

interface DashboardProps {
  onLogout: () => void
}

interface Project {
  id: number
  name: string
  code: string
  disabled: boolean
  created_at: string
  updated_at: string
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'generate' | 'stats' | 'projects'>('generate')
  const [licenseType, setLicenseType] = useState<'year' | 'permanent' | 'custom'>('year')
  const [project, setProject] = useState('zupu')
  const [customExpiry, setCustomExpiry] = useState('')
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

  // Projects management
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectForm, setProjectForm] = useState({ name: '', code: '', disabled: false })
  const [projectError, setProjectError] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // 加载项目列表
  useEffect(() => {
    loadProjects()
  }, [])

  const generateKey = async () => {
    setIsGenerating(true)
    setError('')
    setGeneratedKey('')

    try {
      const prefix = licenseType === 'permanent' ? 'GLP' : 'GLY'
      const randomPart = () => Math.random().toString(36).substring(2, 6).toUpperCase()
      const newKey = `${prefix}-${randomPart()}-${randomPart()}-${randomPart()}-${randomPart()}`

      // Calculate expires_at based on license type
      let expiresAt = null
      if (licenseType === 'year') {
        const d = new Date()
        d.setFullYear(d.getFullYear() + 1)
        expiresAt = d.toISOString().slice(0, 19).replace('T', ' ')
      } else if (licenseType === 'custom' && customExpiry) {
        // Convert datetime-local format (YYYY-MM-DDTHH:MM) to backend format (YYYY-MM-DD HH:MM:SS)
        expiresAt = customExpiry + ':00'
      }

      const res = await fetch('/api/license/create_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          license_key: newKey,
          license_type: licenseType === 'custom' ? 'year' : licenseType,
          project: project,
          expires_at: expiresAt
        })
      })

      if (res.ok) {
        const data = await res.json()
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

  // Project management functions
  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProjects(data.data)
      }
    } catch (err) {
      console.error('加载项目失败:', err)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const openProjectModal = (project?: Project) => {
    if (project) {
      setEditingProject(project)
      setProjectForm({ name: project.name, code: project.code, disabled: project.disabled })
    } else {
      setEditingProject(null)
      setProjectForm({ name: '', code: '', disabled: false })
    }
    setProjectError('')
    setShowProjectModal(true)
  }

  const closeProjectModal = () => {
    setShowProjectModal(false)
    setEditingProject(null)
    setProjectForm({ name: '', code: '', disabled: false })
    setProjectError('')
  }

  const saveProject = async () => {
    setProjectError('')
    if (!projectForm.name || !projectForm.code) {
      setProjectError('请填写名称和编码')
      return
    }

    try {
      const url = editingProject ? `/api/projects/${editingProject.id}` : '/api/projects'
      const method = editingProject ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(projectForm)
      })

      if (res.ok) {
        closeProjectModal()
        loadProjects()
      } else {
        const data = await res.json()
        setProjectError(data.detail || '保存失败')
      }
    } catch (err) {
      setProjectError('网络错误')
    }
  }

  const deleteProject = async (project: Project) => {
    if (!confirm(`确定要删除项目"${project.name}"吗？`)) return

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (res.ok) {
        loadProjects()
        if (selectedProject?.id === project.id) {
          setSelectedProject(null)
        }
      } else {
        const data = await res.json()
        alert(data.detail || '删除失败')
      }
    } catch (err) {
      alert('网络错误')
    }
  }

  const viewProject = (project: Project) => {
    setSelectedProject(project)
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
          <button
            onClick={() => { setActiveTab('projects'); loadProjects(); }}
            style={{
              ...styles.navItem,
              backgroundColor: activeTab === 'projects' ? 'white' : 'transparent',
              color: activeTab === 'projects' ? '#667eea' : 'white'
            }}
          >
            <Folder size={20} />
            <span>项目管理</span>
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
                {/* 项目选择 */}
                <div style={styles.field}>
                  <label style={styles.label}>项目</label>
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    style={styles.select}
                  >
                    {projects.length === 0 && <option value="zupu">祖谱 (默认)</option>}
                    {projects.map(p => (
                      <option key={p.id} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>

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
                  <button
                    onClick={() => setLicenseType('custom')}
                    style={{
                      ...styles.typeButton,
                      backgroundColor: licenseType === 'custom' ? '#667eea' : '#f5f5f5',
                      color: licenseType === 'custom' ? 'white' : '#333'
                    }}
                  >
                    自定义
                  </button>
                </div>

                {/* 自定义到期时间 */}
                {licenseType === 'custom' && (
                  <div style={styles.field}>
                    <label style={styles.label}>到期时间</label>
                    <input
                      type="datetime-local"
                      value={customExpiry}
                      onChange={(e) => setCustomExpiry(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                )}

                <button
                  onClick={generateKey}
                  disabled={isGenerating || (licenseType === 'custom' && !customExpiry)}
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
                      {licenseType === 'year' ? '年度授权，自发放日起1年内有效' :
                       licenseType === 'permanent' ? '永久授权，无有效期限制' :
                       `自定义到期时间: ${customExpiry}`}
                      {project && <span> | 项目: {project}</span>}
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

        {activeTab === 'projects' && (
          <div style={styles.content}>
            <div style={styles.contentHeader}>
              <h2 style={styles.pageTitle}>项目管理</h2>
              <button onClick={() => openProjectModal()} style={styles.addButton}>
                <Plus size={18} />
                <span>新增项目</span>
              </button>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {isLoadingProjects ? (
              <div style={styles.loading}>加载中...</div>
            ) : (
              <div style={styles.card}>
                <div style={styles.cardContent}>
                  {projects.length > 0 ? (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>名称</th>
                          <th style={styles.th}>编码</th>
                          <th style={styles.th}>状态</th>
                          <th style={styles.th}>创建时间</th>
                          <th style={styles.th}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => (
                          <tr key={p.id} style={styles.tr}>
                            <td style={styles.td}>{p.name}</td>
                            <td style={styles.td}>
                              <code style={styles.code}>{p.code}</code>
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.badge,
                                backgroundColor: p.disabled ? '#fee' : '#efe',
                                color: p.disabled ? '#e53e3e' : '#38a169'
                              }}>
                                {p.disabled ? '已禁用' : '启用'}
                              </span>
                            </td>
                            <td style={styles.td}>{p.created_at}</td>
                            <td style={styles.td}>
                              <div style={styles.actions}>
                                <button
                                  onClick={() => openProjectModal(p)}
                                  style={styles.actionButton}
                                  title="编辑"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => deleteProject(p)}
                                  style={{ ...styles.actionButton, color: '#e53e3e' }}
                                  title="删除"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={styles.empty}>暂无项目，点击"新增项目"添加</div>
                  )}
                </div>
              </div>
            )}

            {/* 项目详情 */}
            {selectedProject && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>项目详情</h3>
                </div>
                <div style={styles.cardContent}>
                  <div style={styles.detailGrid}>
                    <div style={styles.detailItem}>
                      <label style={styles.detailLabel}>名称</label>
                      <div style={styles.detailValue}>{selectedProject.name}</div>
                    </div>
                    <div style={styles.detailItem}>
                      <label style={styles.detailLabel}>编码</label>
                      <div style={styles.detailValue}>
                        <code style={styles.code}>{selectedProject.code}</code>
                      </div>
                    </div>
                    <div style={styles.detailItem}>
                      <label style={styles.detailLabel}>状态</label>
                      <div style={styles.detailValue}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: selectedProject.disabled ? '#fee' : '#efe',
                          color: selectedProject.disabled ? '#e53e3e' : '#38a169'
                        }}>
                          {selectedProject.disabled ? '已禁用' : '启用'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.detailItem}>
                      <label style={styles.detailLabel}>创建时间</label>
                      <div style={styles.detailValue}>{selectedProject.created_at}</div>
                    </div>
                    <div style={styles.detailItem}>
                      <label style={styles.detailLabel}>更新时间</label>
                      <div style={styles.detailValue}>{selectedProject.updated_at}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedProject(null)}
                    style={styles.closeDetailButton}
                  >
                    关闭详情
                  </button>
                </div>
              </div>
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

      {/* 项目管理弹窗 */}
      {showProjectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingProject ? '编辑项目' : '新增项目'}</h3>
              <button onClick={closeProjectModal} style={styles.closeButton}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalContent}>
              <div style={styles.formField}>
                <label style={styles.formLabel}>名称</label>
                <input
                  type="text"
                  placeholder="请输入项目名称"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  style={styles.modalInput}
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel}>编码</label>
                <input
                  type="text"
                  placeholder="请输入项目编码"
                  value={projectForm.code}
                  onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                  style={styles.modalInput}
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel}>
                  <input
                    type="checkbox"
                    checked={projectForm.disabled}
                    onChange={(e) => setProjectForm({ ...projectForm, disabled: e.target.checked })}
                    style={styles.checkbox}
                  />
                  禁用该项目
                </label>
              </div>
              {projectError && <div style={styles.error}>{projectError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={closeProjectModal} style={styles.cancelButton}>取消</button>
              <button onClick={saveProject} style={styles.confirmButton}>保存</button>
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
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px'
  },
  label: {
    fontSize: '14px',
    color: '#666',
    fontWeight: 500
  },
  select: {
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px',
    backgroundColor: '#fafafa',
    cursor: 'pointer'
  },
  input: {
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px',
    backgroundColor: '#fafafa'
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
  },
  // Projects page styles
  contentHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '30px'
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  code: {
    padding: '2px 6px',
    background: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'monospace'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: '#f5f5f5',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#666'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  detailLabel: {
    fontSize: '13px',
    color: '#888'
  },
  detailValue: {
    fontSize: '15px',
    color: '#333'
  },
  closeDetailButton: {
    marginTop: '20px',
    padding: '10px 16px',
    background: '#f5f5f5',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #f0f0f0'
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#999'
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  formLabel: {
    fontSize: '14px',
    color: '#666',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  }
}