import { getMyStaffPublicCard, updateMyStaffPublicCard } from '@/services/api';
import { uploadFileToCosBySts } from '@/utils/cosUpload';
import {
  transcodeVideoForUpload,
  type VideoRotation,
} from '@/utils/videoTranscode';
import { UploadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Image,
  Input,
  message,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

const statusMap: any = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING: { text: '审核中', color: 'processing' },
  APPROVED: { text: '已公开', color: 'success' },
  REJECTED: { text: '已驳回', color: 'error' },
};
const tagOptions = [
  '教学指导',
  '娱乐陪伴',
  '上分冲段',
  '战术指挥',
  '耐心沟通',
  '气氛活跃',
  '技术稳定',
  '准时守约',
].map((value) => ({ label: value, value }));

function MediaUpload({
  value = [],
  onChange,
  accept,
  scene,
  max = 20,
  disabled = false,
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  accept: string;
  scene: string;
  max?: number;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [rotation, setRotation] = useState<VideoRotation>(0);
  const [progress, setProgress] = useState(0);
  const list = Array.isArray(value) ? value : [];
  const limitMB =
    scene === 'avatar' ? 1 : scene === 'audio' ? 5 : scene === 'video' ? 20 : 2;
  const durationHint =
    scene === 'audio' || scene === 'video' ? '，时长不超过 60 秒' : '';
  const upload = async (file: File) => {
    try {
      setUploading(true);
      setProgress(0);
      const uploadFile =
        scene === 'video'
          ? await transcodeVideoForUpload(file, rotation, setProgress)
          : file;
      const result = await uploadFileToCosBySts({
        module: 'staff-card',
        scene,
        file: uploadFile,
      });
      onChange?.([...list, result.url].slice(0, max));
      message.success(scene === 'video' ? '转码并上传成功' : '上传成功');
    } catch (e: any) {
      message.error(e?.message || '上传失败');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {scene === 'video' ? (
        <Space wrap>
          <Typography.Text>上传前旋转</Typography.Text>
          <Segmented
            disabled={disabled || uploading}
            value={rotation}
            onChange={(value) => setRotation(value as VideoRotation)}
            options={[
              { label: '不旋转', value: 0 },
              { label: '顺时针 90°', value: 90 },
              { label: '180°', value: 180 },
              { label: '顺时针 270°', value: 270 },
            ]}
          />
        </Space>
      ) : null}
      <Space>
        <Upload
          accept={accept}
          showUploadList={false}
          disabled={disabled || uploading}
          beforeUpload={(file) => {
            void upload(file as File);
            return false;
          }}
        >
          <Button
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={disabled || list.length >= max}
          >
            {scene === 'video' && uploading ? '正在转码上传' : '上传文件'}
          </Button>
        </Upload>
        <Typography.Text type="secondary">
          {scene === 'video'
            ? '原视频最大 200MB，转码后不超过 20MB'
            : `单个文件不超过 ${limitMB}MB`}
          ，最多 {max} 个{durationHint}
        </Typography.Text>
      </Space>
      {scene === 'video' && uploading ? (
        <Progress percent={progress} status="active" size="small" />
      ) : null}
      {list.length ? (
        <Space wrap>
          {list.map((url) => (
            <Space key={url} direction="vertical" size={2}>
              {accept.startsWith('image') ? (
                <Image
                  src={url}
                  width={96}
                  height={96}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                />
              ) : (
                <a href={url} target="_blank" rel="noreferrer">
                  {url.split('/').pop() || '查看文件'}
                </a>
              )}
              <Button
                danger
                size="small"
                type="link"
                disabled={disabled}
                onClick={() => onChange?.(list.filter((item) => item !== url))}
              >
                删除
              </Button>
            </Space>
          ))}
        </Space>
      ) : (
        <span style={{ color: '#999' }}>暂未上传</span>
      )}
    </Space>
  );
}

export default function MyStaffCardPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [card, setCard] = useState<any>({});
  const load = async () => {
    try {
      setLoading(true);
      const result: any = await getMyStaffPublicCard();
      const value = result?.card || result?.defaults || {};
      setCard(value);
      form.setFieldsValue({
        ...value,
        avatarUrls: value.avatarUrl ? [value.avatarUrl] : [],
        imageUrls: Array.isArray(value.imageUrls) ? value.imageUrls : [],
        gameTags: Array.isArray(value.gameTags) ? value.gameTags : [],
        skillTags: Array.isArray(value.skillTags) ? value.skillTags : [],
        audioUrls: value.audioUrl ? [value.audioUrl] : [],
        videoUrls: value.videoUrl ? [value.videoUrl] : [],
        assessmentAt: value.assessmentAt ? dayjs(value.assessmentAt) : null,
        antiCheatImages: Array.isArray(value.antiCheatImages)
          ? value.antiCheatImages
          : [],
        resultImages: Array.isArray(value.resultImages)
          ? value.resultImages
          : [],
      });
    } catch (e: any) {
      message.error(e?.message || '名片加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const submit = async (publish: boolean) => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateMyStaffPublicCard({
        ...values,
        avatarUrl: values.avatarUrls?.[0] || '',
        audioUrl: values.audioUrls?.[0] || '',
        videoUrl: values.videoUrls?.[0] || '',
        assessmentAt: values.assessmentAt?.toISOString?.() || null,
        submit: publish,
      });
      message.success(publish ? '名片已提交审核' : '草稿已保存');
      await load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };
  const pending = card?.status === 'PENDING';
  if (loading)
    return (
      <PageContainer>
        <Card>
          <Spin /> 正在加载名片...
        </Card>
      </PageContainer>
    );
  return (
    <PageContainer
      title="我的名片"
      subTitle="完善资料并提交审核，审核通过后将在小程序服务者主页展示"
    >
      {card?.status ? (
        <Alert
          style={{ marginBottom: 16 }}
          type={
            card.status === 'REJECTED'
              ? 'error'
              : card.status === 'APPROVED'
              ? 'success'
              : 'info'
          }
          showIcon
          message={
            <Space>
              当前状态
              <Tag color={statusMap[card.status]?.color}>
                {statusMap[card.status]?.text || card.status}
              </Tag>
            </Space>
          }
          description={
            card.status === 'REJECTED'
              ? card.reviewRemark || '名片未通过审核，请修改后重新提交'
              : card.status === 'PENDING'
              ? '审核期间暂不可修改，请等待管理员处理'
              : card.status === 'APPROVED'
              ? '名片已在小程序公开；修改后需要重新提交审核'
              : '资料仅为草稿，尚未公开'
          }
        />
      ) : null}
      <Card>
        <Form form={form} layout="vertical" disabled={pending}>
          <Form.Item
            name="displayName"
            label="展示名称"
            rules={[{ required: true, message: '请填写展示名称' }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item
            name="avatarUrls"
            label="头像"
            rules={[{ required: true, message: '请上传头像' }]}
          >
            <MediaUpload
              accept="image/*"
              scene="avatar"
              max={1}
              disabled={pending}
            />
          </Form.Item>
          <Form.Item name="imageUrls" label="形象照">
            <MediaUpload
              accept="image/*"
              scene="profile-images"
              max={3}
              disabled={pending}
            />
          </Form.Item>
          <Form.Item name="slogan" label="个人标语">
            <Input
              maxLength={30}
              showCount
              placeholder="一句话介绍你的服务风格"
            />
          </Form.Item>
          <Form.Item name="gameTags" label="擅长游戏">
            <Select
              mode="tags"
              tokenSeparators={[',', '，']}
              placeholder="输入游戏名称后回车"
            />
          </Form.Item>
          <Form.Item name="skillTags" label="服务标签">
            <Select
              mode="tags"
              options={tagOptions}
              tokenSeparators={[',', '，']}
              placeholder="选择快捷标签或自行输入"
            />
          </Form.Item>
          <Form.Item name="bio" label="个人文字介绍">
            <Input.TextArea rows={5} maxLength={500} showCount />
          </Form.Item>
          <Form.Item name="audioUrls" label="个人语音介绍">
            <MediaUpload
              accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/aac"
              scene="audio"
              max={1}
              disabled={pending}
            />
          </Form.Item>
          <Form.Item name="videoUrls" label="个人视频介绍">
            <MediaUpload
              accept=".mov,.mp4,.m4v,.webm,.mkv,.avi,.3gp,.3gpp,.mpeg,.mpg,.ts,.mts,.m2ts,video/*"
              scene="video"
              max={1}
              disabled={pending}
            />
          </Form.Item>
          <Form.Item name="assessmentAt" label="考核时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="antiCheatImages" label="查挂快照图片">
            <MediaUpload
              accept="image/*"
              scene="anti-cheat"
              max={1}
              disabled={pending}
            />
          </Form.Item>
          <Form.Item name="resultImages" label="考核战绩图片">
            <MediaUpload
              accept="image/*"
              scene="assessment-results"
              max={3}
              disabled={pending}
            />
          </Form.Item>
          <Space>
            <Button
              disabled={pending}
              loading={saving}
              onClick={() => submit(false)}
            >
              保存草稿
            </Button>
            <Button
              type="primary"
              disabled={pending}
              loading={saving}
              onClick={() => submit(true)}
            >
              提交审核
            </Button>
          </Space>
        </Form>
      </Card>
    </PageContainer>
  );
}
