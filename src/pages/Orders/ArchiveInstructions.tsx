import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, message, Space, Spin, Typography } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';
import '@wangeditor/editor/dist/css/style.css';
import { getOrderArchiveInstructions, upsertOrderArchiveInstructions } from '@/services/api';

const ArchiveInstructionsPage: React.FC = () => {
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getOrderArchiveInstructions()
      .then((result) => setContent(String(result?.content || '')))
      .catch((error) => message.error(error?.data?.message || error?.message || '加载存单说明失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => editor?.destroy(), [editor]);

  const toolbarConfig = useMemo<Partial<IToolbarConfig>>(() => ({
    toolbarKeys: [
      'headerSelect', 'bold', 'italic', 'underline', 'through', '|',
      'color', 'bgColor', '|', 'bulletedList', 'numberedList', 'blockquote', '|',
      'insertLink', 'insertTable', '|', 'undo', 'redo',
    ],
  }), []);
  const editorConfig = useMemo<Partial<IEditorConfig>>(() => ({
    placeholder: '请输入服务者存单前需要阅读的说明，可使用标题、颜色、加粗、列表及表格排版',
  }), []);

  const save = async () => {
    const plainText = String(content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
    if (!plainText) {
      message.warning('请输入存单说明');
      return;
    }
    try {
      setSaving(true);
      await upsertOrderArchiveInstructions(content);
      message.success('存单说明已更新，服务者下次打开存单弹窗时生效');
    } catch (error: any) {
      message.error(error?.data?.message || error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="存单说明维护" subTitle="由店长或客服主管维护，展示在服务者存单弹窗中">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="建议清楚说明存单前核对事项"
        description="例如：准确游戏ID必须为纯数字、进度或时长填写口径、异常情况备注要求。富文本仅在“存单”弹窗展示，不影响结单。"
      />
      <Card>
        {loading ? <Spin /> : (
          <>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
              <Toolbar editor={editor} defaultConfig={toolbarConfig} mode="default" style={{ borderBottom: '1px solid #f0f0f0' }} />
              <Editor
                defaultConfig={editorConfig}
                value={content}
                onCreated={setEditor}
                onChange={(current) => setContent(current.getHtml())}
                mode="default"
                style={{ height: 420, overflowY: 'hidden' }}
              />
            </div>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 16 }}>
              <Typography.Text type="secondary">保存后立即生效，无需重新发布前端。</Typography.Text>
              <Button type="primary" loading={saving} onClick={save}>保存存单说明</Button>
            </Space>
          </>
        )}
      </Card>
    </PageContainer>
  );
};

export default ArchiveInstructionsPage;
