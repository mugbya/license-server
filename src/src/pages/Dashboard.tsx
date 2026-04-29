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
  const [activeTab, setActiveTab] = useState<'generate' | 'key_list' | 'usage_stats' | 'keys_stats' | 'projects'>('generate')
  const [activeMenu, setActiveMenu] = useState<'license' | 'stats'>('license')
  const [licenseType, setLicenseType] = useState<'year' | 'permanent' | 'custom'>('year')
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

  // License keys management
  const [licenseKeys, setLicenseKeys] = useState<any[]>([])
  const [keysStats, setKeysStats] = useState<any>(null)
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)

  // Projects management
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showProjectsListModal, setShowProjectsListModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectForm, setProjectForm] = useState({ name: '', code: '', disabled: false })
  const [projectError, setProjectError] = useState('')
  const [currentProject, setCurrentProject] = useState<Project | null>(null)

  // 加载项目列表
  useEffect(() => {
    loadProjects()
  }, [])

  const generateKey = async () => {
    setIsGenerating(true)
    setError('')
    setGeneratedKey('')

    try {
      // Calculate expires_at based on license type
      let expiresAt = null
      if (licenseType === 'year') {
        const d = new Date()
        d.setFullYear(d.getFullYear() + 1)
        expiresAt = d.toISOString().slice(0, 19).replace('T', ' ')
      } else if (licenseType === 'custom' && customExpiry) {
        // Convert datetime-local format (YYYY-MM-DDTHH:MM) to backend format (YYYY-MM-DD HH:MM:SS)
        expiresAt = customExpiry.replace('T', ' ') + ':00'
      }

      const res = await fetch('/api/license/create_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          license_type: licenseType,
          project: currentProject?.code || 'zupu',
          expires_at: expiresAt
        })
      })

      if (res.ok) {
        const data = await res.json()
        // Use the encoded key returned from backend
        setGeneratedKey(data.encoded_key || data.license_key)
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
      const url = currentProject ? `/api/license/stats?project=${currentProject.code}` : '/api/license/stats'
      const res = await fetch(url, {
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
        // Auto-select first enabled project if none selected
        if (!currentProject && data.data.filter((p: Project) => !p.disabled).length > 0) {
          const firstEnabled = data.data.find((p: Project) => !p.disabled)
          setCurrentProject(firstEnabled)
        }
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
        if (currentProject?.id === project.id) {
          setCurrentProject(null)
        }
      } else {
        const data = await res.json()
        alert(data.detail || '删除失败')
      }
    } catch (err) {
      alert('网络错误')
    }
  }

  // License Keys management functions
  const loadLicenseKeys = async () => {
    setIsLoadingKeys(true)
    try {
      const url = currentProject ? `/api/license/keys?project=${currentProject.code}` : '/api/license/keys'
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLicenseKeys(data.data)
      }
    } catch (err) {
      console.error('加载序列码失败:', err)
    } finally {
      setIsLoadingKeys(false)
    }
  }

  const loadKeysStats = async () => {
    try {
      const statsUrl = currentProject ? `/api/license/keys/stats?project=${currentProject.code}` : '/api/license/keys/stats'
      const statsRes = await fetch(statsUrl, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setKeysStats(statsData.data)
      }
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }

  const revokeLicenseKey = async (licenseKey: string) => {
    if (!confirm(`确定要撤销序列码 ${licenseKey} 吗？`)) return

    try {
      const res = await fetch(`/api/license/revoke?license_key=${encodeURIComponent(licenseKey)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (res.ok) {
        loadLicenseKeys()
      } else {
        const data = await res.json()
        alert(data.detail || '撤销失败')
      }
    } catch (err) {
      alert('网络错误')
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

        {/* 项目选择器 */}
        <div style={styles.projectSelector}>
          <label style={styles.projectSelectorLabel}>当前项目</label>
          <select
            value={currentProject?.id || ''}
            onChange={(e) => {
              const selected = projects.find(p => p.id === Number(e.target.value))
              setCurrentProject(selected || null)
              setActiveMenu('license')
            }}
            style={styles.projectSelect}
          >
            {projects.filter(p => !p.disabled).length === 0 && <option value="">暂无可用项目</option>}
            {projects.filter(p => !p.disabled).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* 一级菜单 */}
        {currentProject && (
          <div style={styles.menuSection}>
            {/* 序列码管理 */}
            <div style={styles.menuGroup}>
              <button
                onClick={() => {
                  setActiveMenu('license')
                  setActiveTab('generate')
                }}
                style={{
                  ...styles.menuButton,
                  backgroundColor: activeMenu === 'license' ? 'rgba(255,255,255,0.15)' : 'transparent',
                  borderLeftColor: activeMenu === 'license' ? '#667eea' : 'transparent'
                }}
              >
                <Key size={18} />
                <span>序列码管理</span>
              </button>

              {/* 二级菜单 */}
              {activeMenu === 'license' && (
                <div style={styles.subMenu}>
                  <button
                    onClick={() => {
                      setActiveMenu('license')
                      setActiveTab('generate')
                    }}
                    style={{
                      ...styles.subMenuItem,
                      backgroundColor: activeTab === 'generate' ? 'white' : 'transparent',
                      color: activeTab === 'generate' ? '#667eea' : 'rgba(255,255,255,0.7)'
                    }}
                  >
                    生成序列码
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu('license')
                      setActiveTab('key_list')
                      loadLicenseKeys()
                    }}
                    style={{
                      ...styles.subMenuItem,
                      backgroundColor: activeTab === 'key_list' ? 'white' : 'transparent',
                      color: activeTab === 'key_list' ? '#667eea' : 'rgba(255,255,255,0.7)'
                    }}
                  >
                    序列码列表
                  </button>
                </div>
              )}
            </div>

            {/* 数据统计 */}
            <div style={styles.menuGroup}>
              <button
                onClick={() => {
                  setActiveMenu('stats')
                  setActiveTab('usage_stats')
                }}
                style={{
                  ...styles.menuButton,
                  backgroundColor: activeMenu === 'stats' ? 'rgba(255,255,255,0.15)' : 'transparent',
                  borderLeftColor: activeMenu === 'stats' ? '#667eea' : 'transparent'
                }}
              >
                <BarChart3 size={18} />
                <span>数据统计</span>
              </button>

              {/* 二级菜单 */}
              {activeMenu === 'stats' && (
                <div style={styles.subMenu}>
                  <button
                    onClick={() => {
                      setActiveMenu('stats')
                      setActiveTab('usage_stats')
                      loadStats()
                    }}
                    style={{
                      ...styles.subMenuItem,
                      backgroundColor: activeTab === 'usage_stats' ? 'white' : 'transparent',
                      color: activeTab === 'usage_stats' ? '#667eea' : 'rgba(255,255,255,0.7)'
                    }}
                  >
                    使用统计
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenu('stats')
                      setActiveTab('keys_stats')
                      loadKeysStats()
                    }}
                    style={{
                      ...styles.subMenuItem,
                      backgroundColor: activeTab === 'keys_stats' ? 'white' : 'transparent',
                      color: activeTab === 'keys_stats' ? '#667eea' : 'rgba(255,255,255,0.7)'
                    }}
                  >
                    序列码统计
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={styles.bottom}>
          <button
            onClick={() => { setActiveTab('projects'); loadProjects(); }}
            style={styles.navItem}
          >
            <Folder size={20} />
            <span>项目管理</span>
          </button>
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
        {!currentProject && (
          <div style={styles.content}>
            <h2 style={styles.pageTitle}>欢迎使用授权管理系统</h2>
            <div style={styles.card}>
              <div style={styles.cardContent}>
                <div style={styles.empty}>
                  <p>暂无项目，请先在"项目管理"中创建项目</p>
                  <button onClick={() => loadProjects()} style={styles.addButton}>
                    <RefreshCw size={18} />
                    <span>刷新项目列表</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentProject && activeTab === 'generate' && (
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
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usage_stats' && currentProject && (
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
          </div>
        )}

        {activeTab === 'key_list' && currentProject && (
          <div style={styles.content}>
            <h2 style={styles.pageTitle}>序列码列表</h2>

            {error && <div style={styles.error}>{error}</div>}

            {isLoadingKeys ? (
              <div style={styles.loading}>加载中...</div>
            ) : (
              <div style={styles.card}>
                <div style={styles.cardContent}>
                  {licenseKeys.length > 0 ? (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>序列码</th>
                          <th style={styles.th}>类型</th>
                          <th style={styles.th}>状态</th>
                          <th style={styles.th}>绑定机器</th>
                          <th style={styles.th}>到期时间</th>
                          <th style={styles.th}>是否过期</th>
                          <th style={styles.th}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {licenseKeys.map((k) => (
                          <tr key={k.id} style={styles.tr}>
                            <td style={styles.td}>
                              <code style={styles.code}>{k.license_key}</code>
                            </td>
                            <td style={styles.td}>
                              {k.license_type === 'year' ? '年度' : k.license_type === 'permanent' ? '永久' : k.license_type === 'custom' ? '自定义' : k.license_type}
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.badge,
                                backgroundColor: k.revoked ? '#fee' : k.machine_code ? '#efe' : '#eef',
                                color: k.revoked ? '#e53e3e' : k.machine_code ? '#38a169' : '#3182ce'
                              }}>
                                {k.revoked ? '已撤销' : k.machine_code ? '已激活' : '未激活'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: '14px', color: '#666', fontFamily: 'monospace' }}>
                                {k.machine_code || '-'}
                              </span>
                            </td>
                            <td style={styles.td}>{k.expires_at || '-'}</td>
                            <td style={styles.td}>
                              {k.expires_at ? (
                                new Date(k.expires_at) < new Date() ? (
                                  <span style={{ color: '#e53e3e' }}>已过期</span>
                                ) : (
                                  <span style={{ color: '#38a169' }}>有效</span>
                                )
                              ) : (
                                <span style={{ color: '#666' }}>-</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <div style={styles.actions}>
                                {!k.revoked && (
                                  <button
                                    onClick={() => revokeLicenseKey(k.license_key)}
                                    style={{ ...styles.actionButton, color: '#e53e3e' }}
                                    title="撤销"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={styles.empty}>暂无序列码，点击"生成序列码"创建</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'keys_stats' && currentProject && (
          <div style={styles.content}>
            <h2 style={styles.pageTitle}>序列码统计</h2>

            {keysStats && (
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{keysStats.total || 0}</div>
                  <div style={styles.statLabel}>总序列码</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{keysStats.activated || 0}</div>
                  <div style={styles.statLabel}>已激活</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{keysStats.revoked || 0}</div>
                  <div style={styles.statLabel}>已撤销</div>
                </div>
              </div>
            )}

            {keysStats?.by_type && keysStats.by_type.length > 0 && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>按类型统计</h3>
                </div>
                <div style={styles.cardContent}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>类型</th>
                        <th style={styles.th}>数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keysStats.by_type.map((item: any, index: number) => (
                        <tr key={index} style={styles.tr}>
                          <td style={styles.td}>
                            {item.type === 'year' ? '年度' : item.type === 'permanent' ? '永久' : item.type === 'custom' ? '自定义' : item.type}
                          </td>
                          <td style={styles.td}>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
    width: '280px',
    background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
    padding: '24px',
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
  projectSelector: {
    marginBottom: '20px',
    padding: '12px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '10px'
  },
  projectSelectorLabel: {
    display: 'block',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '10px',
    textTransform: 'uppercase'
  },
  projectSelect: {
    width: '100%',
    padding: '12px 14px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    background: 'white',
    cursor: 'pointer'
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  navSection: {
    marginBottom: '8px'
  },
  navSectionTitle: {
    display: 'block',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    padding: '8px 16px',
    textTransform: 'uppercase'
  },
  menuSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '20px'
  },
  menuGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  menuButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    border: 'none',
    borderLeft: '3px solid transparent',
    borderRadius: '0',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    width: '100%',
    background: 'transparent',
    color: 'rgba(255,255,255,0.9)'
  },
  subMenu: {
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: '24px',
    gap: '4px'
  },
  subMenuItem: {
    padding: '14px 20px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    width: '100%'
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
    width: '100%'
  },
  pageTitle: {
    fontSize: '28px',
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
    padding: '28px 32px',
    borderBottom: '1px solid #f0f0f0'
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#333'
  },
  cardContent: {
    padding: '32px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px'
  },
  label: {
    fontSize: '18px',
    color: '#666',
    fontWeight: 500
  },
  select: {
    padding: '16px 20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '18px',
    backgroundColor: '#fafafa',
    cursor: 'pointer'
  },
  input: {
    padding: '16px 20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '18px',
    backgroundColor: '#fafafa'
  },
  typeSelector: {
    display: 'flex',
    gap: '16px',
    marginBottom: '28px'
  },
  typeButton: {
    flex: 1,
    padding: '18px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '17px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  generateButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '18px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '18px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  error: {
    padding: '14px 18px',
    background: '#fff5f5',
    color: '#e53e3e',
    borderRadius: '8px',
    fontSize: '16px',
    marginTop: '18px'
  },
  resultBox: {
    marginTop: '28px',
    padding: '24px',
    background: '#f8f9ff',
    borderRadius: '10px',
    border: '1px solid #e8ecff'
  },
  resultLabel: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '14px'
  },
  resultKey: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    background: 'white',
    padding: '18px 24px',
    borderRadius: '8px',
    border: '1px solid #ddd'
  },
  copyButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    cursor: 'pointer'
  },
  resultHint: {
    marginTop: '14px',
    fontSize: '15px',
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
    padding: '14px 12px',
    fontSize: '15px',
    color: '#666',
    fontWeight: 600,
    borderBottom: '2px solid #f0f0f0'
  },
  tr: {
    borderBottom: '1px solid #f5f5f5'
  },
  td: {
    padding: '14px 12px',
    fontSize: '15px',
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
    width: '480px',
    overflow: 'hidden'
  },
  modalTitle: {
    padding: '24px 28px',
    fontSize: '20px',
    fontWeight: 600,
    borderBottom: '1px solid #f0f0f0'
  },
  modalContent: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  modalInput: {
    padding: '14px 18px',
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
    padding: '4px 8px',
    background: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '14px',
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