import React from 'react';
import { Modal, Form, Input, Select, message, Tag } from 'antd';
import { changeUserLevel, User } from '@/services/api';

const { Option } = Select;
const { TextArea } = Input;

interface ChangeLevelModalProps {
    visible: boolean;
    user: User | null;
    onCancel: () => void;
    onSuccess: () => void;
    availableRatings?: any[]; // 新增：可用评级列表
}

const ChangeLevelModal: React.FC<ChangeLevelModalProps> = ({
                                                               visible,
                                                               user,
                                                               onCancel,
                                                               onSuccess,
                                                               availableRatings = [],
                                                           }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (user) {
                await changeUserLevel(user.id, values);
                form.resetFields();
                onSuccess();
            }
        } catch (error: any) {
            if (error.errorFields) {
                message.error('请完善表单信息');
            } else {
                message.error(error?.response?.data?.message || '调整评级失败');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    // 获取当前评级信息
    const currentRating = user?.staffRating;
    const selectedRatingId = form.getFieldValue('rating');
    const ratingsArr = Array.isArray(availableRatings) ? availableRatings : [];
    const selectedRating = ratingsArr.find((r) => r.id === selectedRatingId);

    return (
        <Modal
            title={`调整员工评级 - ${user?.name || user?.phone}`}
            open={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={500}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                name="changeLevelForm"
            >
                <Form.Item
                    label="当前评级"
                >
                    <div style={{ padding: '8px 0' }}>
                        {currentRating ? (
                            <div>
                                <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                    {currentRating.name}
                                </Tag>
                                <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                                    分红比例: {(currentRating.rate * 100).toFixed(0)}% |
                                    适用范围: {currentRating.scope === 'BOTH' ? '线上线下' : currentRating.scope === 'ONLINE' ? '线上' : '线下'}
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: '#999' }}>未设置评级</div>
                        )}
                    </div>
                </Form.Item>

                <Form.Item
                    label="调整到评级"
                    name="rating"
                    rules={[{ required: true, message: '请选择目标评级' }]}
                >
                    <Select placeholder="请选择目标评级">
                        {availableRatings.map(rating => (
                            <Option key={rating.id} value={rating.id}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{rating.name}</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        分红: {(rating.rate * 100).toFixed(0)}% |
                                        范围: {rating.scope === 'BOTH' ? '通用' : rating.scope === 'ONLINE' ? '线上' : '线下'}
                                    </div>
                                </div>
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    label="调整说明"
                    name="remark"
                    rules={[{ required: true, message: '请填写调整说明' }]}
                >
                    <TextArea
                        placeholder="请填写评级调整的原因和说明..."
                        rows={4}
                        maxLength={200}
                        showCount
                    />
                </Form.Item>

                {user && selectedRating && (
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#f0f8ff',
                        borderRadius: '4px',
                        marginBottom: '16px'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
                            评级变更预览:
                        </div>
                        <div>
                            {user.name} 将从{' '}
                            <strong>
                                {currentRating ? currentRating.name : '无评级'}
                                {currentRating && ` (${(currentRating.rate * 100).toFixed(0)}%)`}
                            </strong>{' '}
                            调整为{' '}
                            <strong>
                                {selectedRating.name} ({(selectedRating.rate * 100).toFixed(0)}%)
                            </strong>
                        </div>
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                            适用范围: {currentRating ?
                            (currentRating.scope === 'BOTH' ? '线上线下' : currentRating.scope === 'ONLINE' ? '线上' : '线下')
                            : '无'
                        } → {selectedRating.scope === 'BOTH' ? '线上线下' : selectedRating.scope === 'ONLINE' ? '线上' : '线下'}
                        </div>
                    </div>
                )}
            </Form>
        </Modal>
    );
};

export default ChangeLevelModal;
