import {
  getStaffPublicCards,
  reviewStaffPublicCard,
  updateStaffPublicCard,
} from '@/services/api';
import { uploadFileToCosBySts } from '@/utils/cosUpload';
import {
  transcodeVideoForUpload,
  type VideoRotation,
} from '@/utils/videoTranscode';
import { UploadOutlined } from '@ant-design/icons';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  message,
  Modal,
  Progress,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';

const statusMap: any = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING: { text: '待审核', color: 'processing' },
  APPROVED: { text: '已通过', color: 'success' },
  REJECTED: { text: '已驳回', color: 'error' },
};
const serviceTagOptions = [
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
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  accept: string;
  scene: string;
  max?: number;
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
            disabled={uploading}
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
          disabled={uploading}
          beforeUpload={(file) => {
            void upload(file as File);
            return false;
          }}
        >
          <Button
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={list.length >= max}
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
                  width={88}
                  height={88}
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
                onClick={() => onChange?.(list.filter((item) => item !== url))}
              >
                删除
              </Button>
            </Space>
          ))}
        </Space>
      ) : (
        <span style={{ color: '#999' }}>未上传</span>
      )}
    </Space>
  );
}

export default function StaffCardsPage() {
  const actionRef = useRef<any>();
  const [reviewRecord, setReviewRecord] = useState<any>(null);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const openEdit = (record: any) => {
    setEditRecord(record);
    form.setFieldsValue({
      ...record,
      avatarUrls: record.avatarUrl ? [record.avatarUrl] : [],
      gameTags: Array.isArray(record.gameTags) ? record.gameTags : [],
      skillTags: Array.isArray(record.skillTags) ? record.skillTags : [],
      imageUrls: Array.isArray(record.imageUrls) ? record.imageUrls : [],
      antiCheatImages: Array.isArray(record.antiCheatImages)
        ? record.antiCheatImages
        : [],
      resultImages: Array.isArray(record.resultImages)
        ? record.resultImages
        : [],
      assessmentAt: record.assessmentAt ? dayjs(record.assessmentAt) : null,
      audioUrls: record.audioUrl ? [record.audioUrl] : [],
      videoUrls: record.videoUrl ? [record.videoUrl] : [],
    });
  };
  const save = async (submit: boolean) => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await updateStaffPublicCard(editRecord.id, {
        ...values,
        avatarUrl: values.avatarUrls?.[0] || '',
        assessmentAt: values.assessmentAt?.toISOString?.() || null,
        audioUrl: values.audioUrls?.[0] || '',
        videoUrl: values.videoUrls?.[0] || '',
        submit,
      });
      message.success(submit ? '已提交审核' : '草稿已保存');
      setEditRecord(null);
      actionRef.current?.reload();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };
  const review = async (status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED' && !remark.trim()) {
      message.warning('驳回时请填写原因');
      return;
    }
    try {
      setLoading(true);
      await reviewStaffPublicCard(reviewRecord.id, {
        status,
        reviewRemark: remark,
      });
      message.success(status === 'APPROVED' ? '审核通过' : '已驳回');
      setReviewRecord(null);
      setRemark('');
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.message || '审核失败');
    } finally {
      setLoading(false);
    }
  };
  const columns: any[] = [
    {
      title: '头像',
      dataIndex: 'avatarUrl',
      search: false,
      width: 76,
      render: (v: any) => (
        <Image
          width={48}
          height={48}
          style={{ borderRadius: 12, objectFit: 'cover' }}
          src={v}
        />
      ),
    },
    { title: '展示名称', dataIndex: 'displayName' },
    {
      title: '账号',
      search: false,
      render: (_: any, r: any) => (
        <div>
          {r.user?.name || '-'}
          <br />
          <span style={{ color: '#999' }}>{r.user?.phone || ''}</span>
        </div>
      ),
    },
    { title: '标语', dataIndex: 'slogan', search: false, ellipsis: true },
    {
      title: '游戏',
      dataIndex: 'gameTags',
      search: false,
      render: (v: any) => (
        <Space wrap>
          {(Array.isArray(v) ? v : []).map((x: string) => (
            <Tag key={x}>{x}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: statusMap,
      render: (_: any, r: any) => (
        <Tag color={statusMap[r.status]?.color}>
          {statusMap[r.status]?.text || r.status}
        </Tag>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_: any, r: any) => [
        <Button key="edit" type="link" onClick={() => openEdit(r)}>
          维护
        </Button>,
        <Button
          key="review"
          type="link"
          disabled={r.status !== 'PENDING'}
          onClick={() => {
            setReviewRecord(r);
            setRemark('');
          }}
        >
          审核
        </Button>,
      ],
    },
  ];
  return (
    <PageContainer
      title="服务者名片管理"
      subTitle="后台统一维护，提交审核通过后在小程序公开展示"
    >
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const data: any = await getStaffPublicCards(params.status);
          return { data: Array.isArray(data) ? data : [], success: true };
        }}
      />
      <Modal
        width={900}
        title="维护服务者名片"
        open={!!editRecord}
        onCancel={() => setEditRecord(null)}
        confirmLoading={loading}
        footer={[
          <Button key="draft" onClick={() => save(false)}>
            保存草稿
          </Button>,
          <Button key="submit" type="primary" onClick={() => save(true)}>
            保存并提交审核
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
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
            <MediaUpload accept="image/*" scene="avatar" max={1} />
          </Form.Item>
          <Form.Item name="imageUrls" label="形象照">
            <MediaUpload accept="image/*" scene="profile-images" max={3} />
          </Form.Item>
          <Form.Item name="slogan" label="个人标语">
            <Input maxLength={30} showCount />
          </Form.Item>
          <Form.Item name="gameTags" label="擅长游戏">
            <Select
              mode="tags"
              tokenSeparators={[',', '，']}
              placeholder="输入后回车，可填写多个"
            />
          </Form.Item>
          <Form.Item name="skillTags" label="服务标签">
            <Select
              mode="tags"
              options={serviceTagOptions}
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
            />
          </Form.Item>
          <Form.Item name="videoUrls" label="个人视频介绍">
            <MediaUpload
              accept=".mov,.mp4,.m4v,.webm,.mkv,.avi,.3gp,.3gpp,.mpeg,.mpg,.ts,.mts,.m2ts,video/*"
              scene="video"
              max={1}
            />
          </Form.Item>
          <Form.Item name="assessmentAt" label="考核时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="antiCheatImages" label="查挂快照图片">
            <MediaUpload accept="image/*" scene="anti-cheat" max={1} />
          </Form.Item>
          <Form.Item name="resultImages" label="考核战绩图片">
            <MediaUpload accept="image/*" scene="assessment-results" max={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        width={960}
        title="服务者公开名片审核"
        open={!!reviewRecord}
        onCancel={() => setReviewRecord(null)}
        confirmLoading={loading}
        footer={[
          <Button key="reject" danger onClick={() => review('REJECTED')}>
            驳回
          </Button>,
          <Button
            key="approve"
            type="primary"
            onClick={() => review('APPROVED')}
          >
            通过并公开
          </Button>,
        ]}
      >
        {reviewRecord ? (
          <div
            style={{ maxHeight: '68vh', overflowY: 'auto', paddingRight: 8 }}
          >
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="头像">
                <Image
                  src={reviewRecord.avatarUrl}
                  width={88}
                  height={88}
                  style={{ objectFit: 'cover', borderRadius: 12 }}
                />
              </Descriptions.Item>
              <Descriptions.Item label="账号">
                {reviewRecord.user?.name || '-'}
                <br />
                <Typography.Text type="secondary">
                  {reviewRecord.user?.phone || ''}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="展示名称">
                {reviewRecord.displayName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="个人标语">
                {reviewRecord.slogan || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="擅长游戏" span={2}>
                <Space wrap>
                  {(Array.isArray(reviewRecord.gameTags)
                    ? reviewRecord.gameTags
                    : []
                  ).map((x: string) => (
                    <Tag key={x} color="blue">
                      {x}
                    </Tag>
                  ))}
                  {!reviewRecord.gameTags?.length ? '-' : null}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="服务标签" span={2}>
                <Space wrap>
                  {(Array.isArray(reviewRecord.skillTags)
                    ? reviewRecord.skillTags
                    : []
                  ).map((x: string) => (
                    <Tag key={x} color="purple">
                      {x}
                    </Tag>
                  ))}
                  {!reviewRecord.skillTags?.length ? '-' : null}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="个人介绍" span={2}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {reviewRecord.bio || '-'}
                </div>
              </Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">形象照</Divider>
            {Array.isArray(reviewRecord.imageUrls) &&
            reviewRecord.imageUrls.length ? (
              <Image.PreviewGroup>
                <Space wrap>
                  {reviewRecord.imageUrls.map((url: string) => (
                    <Image
                      key={url}
                      src={url}
                      width={150}
                      height={150}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="未提交形象照"
              />
            )}
            <Divider orientation="left">个人语音介绍</Divider>
            {reviewRecord.audioUrl ? (
              <audio
                controls
                preload="metadata"
                src={reviewRecord.audioUrl}
                style={{ width: '100%' }}
              >
                当前浏览器不支持音频播放
              </audio>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="未提交语音介绍"
              />
            )}
            <Divider orientation="left">个人视频介绍</Divider>
            {reviewRecord.videoUrl ? (
              <video
                controls
                preload="metadata"
                src={reviewRecord.videoUrl}
                style={{
                  width: '100%',
                  maxHeight: 480,
                  background: '#000',
                  borderRadius: 8,
                }}
              >
                当前浏览器不支持视频播放
              </video>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="未提交视频介绍"
              />
            )}
            <Divider orientation="left">考核资料</Divider>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="考核时间">
                {reviewRecord.assessmentAt
                  ? dayjs(reviewRecord.assessmentAt).format(
                      'YYYY-MM-DD HH:mm:ss',
                    )
                  : '未填写'}
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>查挂快照图片</Typography.Title>
            {Array.isArray(reviewRecord.antiCheatImages) &&
            reviewRecord.antiCheatImages.length ? (
              <Image.PreviewGroup>
                <Space wrap>
                  {reviewRecord.antiCheatImages.map((url: string) => (
                    <Image
                      key={url}
                      src={url}
                      width={150}
                      height={150}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            ) : (
              <Typography.Text type="secondary">未提交</Typography.Text>
            )}
            <Typography.Title level={5}>考核战绩图片</Typography.Title>
            {Array.isArray(reviewRecord.resultImages) &&
            reviewRecord.resultImages.length ? (
              <Image.PreviewGroup>
                <Space wrap>
                  {reviewRecord.resultImages.map((url: string) => (
                    <Image
                      key={url}
                      src={url}
                      width={150}
                      height={150}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            ) : (
              <Typography.Text type="secondary">未提交</Typography.Text>
            )}
            <Divider orientation="left">审核意见</Divider>
            <Input.TextArea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="审核备注；驳回时必填"
            />
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
