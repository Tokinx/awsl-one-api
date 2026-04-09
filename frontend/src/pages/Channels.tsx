import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Channel, ChannelConfig } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  FileJson,
  FileText,
  Link as LinkIcon,
  ArrowLeft,
  Check,
  MoreHorizontal,
  Search,
  ArrowRight,
  Globe,
  Cpu,
} from 'lucide-react'
import { PageContainer } from '@/components/ui/page-container'

type EditMode = 'form' | 'json'

const channelTypes = [
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure-openai-audio', label: 'Azure OpenAI Audio' },
  { value: 'openai-audio', label: 'OpenAI Audio' },
  { value: 'claude', label: 'Claude' },
  { value: 'claude-to-openai', label: 'Claude → OpenAI' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'azure-openai-responses', label: 'Azure OpenAI Responses' },
]

const createDefaultChannelFormData = (): ChannelConfig => ({
  name: '',
  type: 'azure-openai',
  endpoint: '',
  api_keys: [],
  auto_retry: true,
  auto_rotate: true,
  supported_models: [],
  deployment_mapper: {},
})

const parseApiKeys = (value: string): string[] => {
  const seen = new Set<string>()

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      if (seen.has(line)) {
        return false
      }
      seen.add(line)
      return true
    })
}

const formatApiKeys = (apiKeys?: string[]): string => {
  return (apiKeys || []).join('\n')
}

const normalizeChannelFormConfig = (config: ChannelConfig): ChannelConfig => {
  const legacyApiKey = typeof config.api_key === 'string' ? config.api_key.trim() : ''
  const rawApiKeys = Array.isArray(config.api_keys) ? config.api_keys : []
  const mergedKeys = parseApiKeys([legacyApiKey, ...rawApiKeys].join('\n'))

  return {
    ...config,
    api_key: undefined,
    api_keys: mergedKeys,
    auto_retry: config.auto_retry ?? true,
    auto_rotate: config.auto_rotate ?? true,
    supported_models: Array.isArray(config.supported_models) ? config.supported_models : [],
    deployment_mapper: config.deployment_mapper || {},
  }
}

export function Channels() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editMode, setEditMode] = useState<EditMode>('form')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [formData, setFormData] = useState<ChannelConfig>(createDefaultChannelFormData())
  const [channelKey, setChannelKey] = useState('')
  const [jsonValue, setJsonValue] = useState('')
  const [apiKeysInput, setApiKeysInput] = useState('')
  const [supportedModelRows, setSupportedModelRows] = useState<Array<{ model: string }>>([])
  const [mapperRows, setMapperRows] = useState<Array<{ request: string; deployment: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const response = await apiClient.getChannels()
      return response.data as Channel[]
    },
  })

  useEffect(() => {
    const handleClick = () => setOpenMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async ({ key, config }: { key: string; config: any }) => {
      return apiClient.saveChannel(key, config)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      addToast(editingKey ? '渠道更新成功' : '渠道添加成功', 'success')
      resetForm()
      setView('list')
    },
    onError: (error: any) => {
      addToast('保存失败：' + error.message, 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiClient.deleteChannel(key)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      addToast('渠道已删除', 'success')
    },
    onError: (error: any) => {
      addToast('删除失败：' + error.message, 'error')
    },
  })

  const resetForm = () => {
    setFormData(createDefaultChannelFormData())
    setChannelKey('')
    setJsonValue('')
    setApiKeysInput('')
    setSupportedModelRows([])
    setMapperRows([])
    setEditingKey(null)
    setEditMode('form')
  }

  const handleAdd = () => {
    resetForm()
    setView('form')
  }

  const handleEdit = (channel: Channel) => {
    setEditingKey(channel.key)
    setChannelKey(channel.key)
    const rawConfig = typeof channel.value === 'string' ? JSON.parse(channel.value) : channel.value
    const config = normalizeChannelFormConfig(rawConfig)
    setFormData(config)
    setJsonValue(JSON.stringify(config, null, 2))
    setApiKeysInput(formatApiKeys(config.api_keys))
    setSupportedModelRows((config.supported_models || []).map((model) => ({ model })))
    const rows = Object.entries(config.deployment_mapper || {}).map(([request, deployment]) => ({
      request,
      deployment: deployment as string,
    }))
    setMapperRows(rows)
    setView('form')
  }

  const handleDelete = (key: string) => {
    if (confirm(`确定要删除此渠道吗？`)) {
      deleteMutation.mutate(key)
    }
  }

  const handleSave = () => {
    if (!channelKey) {
      addToast('请填写渠道标识', 'error')
      return
    }

    const buildFormConfig = () => {
      const deployment_mapper: Record<string, string> = {}
      mapperRows.forEach((row) => {
        if (row.request && row.deployment) {
          deployment_mapper[row.request] = row.deployment
        }
      })

      const supported_models = supportedModelRows
        .map((row) => row.model.trim())
        .filter((model) => model.length > 0)

      return normalizeChannelFormConfig({
        ...formData,
        api_key: undefined,
        api_keys: parseApiKeys(apiKeysInput),
        supported_models,
        deployment_mapper,
      })
    }

    let config: any
    if (editMode === 'form') {
      const apiKeys = parseApiKeys(apiKeysInput)
      const supportedModels = supportedModelRows
        .map((row) => row.model.trim())
        .filter((model) => model.length > 0)

      if (!formData.name || !formData.endpoint || apiKeys.length === 0) {
        addToast('请填写所有必填字段', 'error')
        return
      }

      if (supportedModels.length === 0) {
        addToast('请至少填写一个支持模型', 'error')
        return
      }

      config = buildFormConfig()
    } else {
      try {
        config = normalizeChannelFormConfig(JSON.parse(jsonValue))
      } catch {
        addToast('JSON格式错误', 'error')
        return
      }
    }

    saveMutation.mutate({ key: channelKey, config })
  }

  const toggleEditMode = () => {
    if (editMode === 'form') {
      const deployment_mapper: Record<string, string> = {}
      mapperRows.forEach((row) => {
        if (row.request && row.deployment) {
          deployment_mapper[row.request] = row.deployment
        }
      })
      const supported_models = supportedModelRows
        .map((row) => row.model.trim())
        .filter((model) => model.length > 0)
      const config = normalizeChannelFormConfig({
        ...formData,
        api_key: undefined,
        api_keys: parseApiKeys(apiKeysInput),
        supported_models,
        deployment_mapper,
      })
      setJsonValue(JSON.stringify(config, null, 2))
      setEditMode('json')
    } else {
      try {
        const config = normalizeChannelFormConfig(JSON.parse(jsonValue))
        setFormData(config)
        setApiKeysInput(formatApiKeys(config.api_keys))
        setSupportedModelRows((config.supported_models || []).map((model: string) => ({ model })))
        const rows = Object.entries(config.deployment_mapper || {}).map(([request, deployment]) => ({
          request,
          deployment: deployment as string,
        }))
        setMapperRows(rows)
        setEditMode('form')
      } catch {
        addToast('JSON格式错误', 'error')
      }
    }
  }

  const addMapperRow = () => {
    setMapperRows([...mapperRows, { request: '', deployment: '' }])
  }

  const addSupportedModelRow = () => {
    setSupportedModelRows([...supportedModelRows, { model: '' }])
  }

  const removeSupportedModelRow = (index: number) => {
    setSupportedModelRows(supportedModelRows.filter((_, i) => i !== index))
  }

  const updateSupportedModelRow = (index: number, value: string) => {
    const newRows = [...supportedModelRows]
    newRows[index].model = value
    setSupportedModelRows(newRows)
  }

  const removeMapperRow = (index: number) => {
    setMapperRows(mapperRows.filter((_, i) => i !== index))
  }

  const updateMapperRow = (index: number, field: 'request' | 'deployment', value: string) => {
    const newRows = [...mapperRows]
    newRows[index][field] = value
    setMapperRows(newRows)
  }

  const getTypeLabel = (type: string) => {
    return channelTypes.find((t) => t.value === type)?.label || type
  }

  const filteredData = data?.filter((channel) => {
    if (!searchQuery) return true
    const config = typeof channel.value === 'string' ? JSON.parse(channel.value) : channel.value
    return (
      config.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.key.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // List View
  if (view === 'list') {
    return (
      <PageContainer
        title="渠道管理"
        description="配置 AI 服务提供商连接"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">添加</span>
            </Button>
          </div>
        }
      >
        {/* Search */}
        {data && data.length > 0 && (
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索渠道..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
          </div>
        ) : !data || data.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <LinkIcon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">添加您的第一个渠道</h3>
              <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
                渠道连接到 AI 服务提供商（如 OpenAI、Azure、Claude），用于代理和转发 API 请求。
              </p>
              <Button onClick={handleAdd} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                添加渠道
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y">
              {filteredData?.map((channel) => {
                const config = typeof channel.value === 'string' ? JSON.parse(channel.value) : channel.value
                const modelCount = (config.supported_models || []).length
                const isMenuOpen = openMenu === channel.key

                return (
                  <div
                    key={channel.key}
                    className="p-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{config.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{channel.key}</div>
                        </div>
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenu(isMenuOpen ? null : channel.key)
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-popover border rounded-lg shadow-lg py-1 z-10">
                              <button
                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                                onClick={() => handleEdit(channel)}
                              >
                                <Pencil className="h-4 w-4" />
                                编辑
                              </button>
                              <button
                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                                onClick={() => handleDelete(channel.key)}
                              >
                                <Trash2 className="h-4 w-4" />
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs">
                          {getTypeLabel(config.type)}
                        </span>
                        <span className="text-muted-foreground">
                          {modelCount} 个模型
                        </span>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:flex md:items-center md:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{config.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{channel.key}</div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium whitespace-nowrap">
                          {getTypeLabel(config.type)}
                        </span>
                      </div>
                      <div className="w-40 text-sm text-muted-foreground truncate font-mono" title={config.endpoint}>
                        {config.endpoint.replace(/^https?:\/\//, '').split('/')[0]}
                      </div>
                      <div className="w-20 text-sm text-center flex-shrink-0">
                        <span className="text-muted-foreground">{modelCount} 模型</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(channel)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(channel.key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredData?.length === 0 && searchQuery && (
                <div className="p-8 text-center text-muted-foreground">
                  未找到匹配的渠道
                </div>
              )}
            </div>
          </Card>
        )}
      </PageContainer>
    )
  }

  // Form View
  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => setView('list')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回列表
          </Button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">{editingKey ? '编辑渠道' : '添加渠道'}</h1>
            <Button variant="outline" size="sm" onClick={toggleEditMode}>
              {editMode === 'form' ? <FileJson className="h-4 w-4 mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
              {editMode === 'form' ? 'JSON' : '表单'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
        {/* Channel Key */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-medium mb-4">渠道标识</h3>
            <p className="text-sm text-muted-foreground mb-3">用于内部识别的唯一标识</p>
            <Input
              value={channelKey}
              onChange={(e) => setChannelKey(e.target.value)}
              placeholder="例如：azure-gpt4-east"
              disabled={!!editingKey}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>

        {editMode === 'form' ? (
          <>
            {/* Basic Info */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-medium mb-4">基本信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">渠道名称 <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例如：Azure GPT-4 东部"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">渠道类型 <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    >
                      {channelTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-medium mb-4">连接配置</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      API 端点 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.endpoint}
                      onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                      placeholder="https://your-resource.openai.azure.com/"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">API 密钥 <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={apiKeysInput}
                      onChange={(e) => {
                        setApiKeysInput(e.target.value)
                        setFormData({ ...formData, api_keys: parseApiKeys(e.target.value) })
                      }}
                      placeholder={'sk-xxx\nsk-yyy'}
                      rows={5}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      可配置多个密钥，每行一个，请求会随机选取一个密钥发起调用。
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 cursor-pointer">
                      <Checkbox
                        className="mt-0.5"
                        checked={formData.auto_retry ?? true}
                        onCheckedChange={(checked) => setFormData({ ...formData, auto_retry: checked })}
                      />
                      <div>
                        <div className="text-sm font-medium">自动重试</div>
                        <p className="text-xs text-muted-foreground">单个密钥遇可重试错误时，自动重试 x3</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 cursor-pointer">
                      <Checkbox
                        className="mt-0.5"
                        checked={formData.auto_rotate ?? true}
                        onCheckedChange={(checked) => setFormData({ ...formData, auto_rotate: checked })}
                      />
                      <div>
                        <div className="text-sm font-medium">自动轮换</div>
                        <p className="text-xs text-muted-foreground">单个密钥多次失败后，自动轮换密钥 x3</p>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      支持模型
                    </h3>
                    <p className="text-sm text-muted-foreground">用于声明这个渠道接受哪些请求模型名，可填写精确值或通配符</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addSupportedModelRow}>
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>

                {supportedModelRows.length === 0 ? (
                  <button
                    type="button"
                    onClick={addSupportedModelRow}
                    className="w-full py-8 border-2 border-dashed rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    添加支持模型
                  </button>
                ) : (
                  <div className="space-y-2">
                    {supportedModelRows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Input
                          value={row.model}
                          onChange={(e) => updateSupportedModelRow(index, e.target.value)}
                          placeholder="gpt-4o-mini-tts 或 gpt-*"
                          className="flex-1 bg-background text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive flex-shrink-0"
                          onClick={() => removeSupportedModelRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Mappings */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      模型映射
                    </h3>
                    <p className="text-sm text-muted-foreground">可选。将请求模型名映射到实际上游 deployment；未填写时默认使用同名</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addMapperRow}>
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>

                {mapperRows.length === 0 ? (
                  <button
                    type="button"
                    onClick={addMapperRow}
                    className="w-full py-8 border-2 border-dashed rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    添加模型映射
                  </button>
                ) : (
                  <div className="space-y-2">
                    {mapperRows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Input
                          value={row.request}
                          onChange={(e) => updateMapperRow(index, 'request', e.target.value)}
                          placeholder="gpt-4"
                          className="flex-1 bg-background text-sm"
                        />
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          value={row.deployment}
                          onChange={(e) => updateMapperRow(index, 'deployment', e.target.value)}
                          placeholder="gpt-4-0613"
                          className="flex-1 bg-background text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive flex-shrink-0"
                          onClick={() => removeMapperRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-5">
              <h3 className="font-medium mb-4">JSON 配置</h3>
              <Textarea
                value={jsonValue}
                onChange={(e) => setJsonValue(e.target.value)}
                rows={18}
                className="font-mono text-sm"
                placeholder='{"name":"Azure OpenAI","type":"azure-openai","endpoint":"https://example.openai.azure.com/","api_keys":["sk-1","sk-2"],"auto_retry":true,"auto_rotate":true}'
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setView('list')}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                保存渠道
              </>
            )}
          </Button>
        </div>
        </div>
      </div>
    </div>
  )
}
