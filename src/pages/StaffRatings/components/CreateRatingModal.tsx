import React from 'react';
import { Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { createStaffRating } from '@/services/api';

const { Option } = Select;
const { TextArea } = Input;

interface CreateRatingModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

const CreateRatingModal: React.FC<CreateRatingModalProps> = ({
                                                                 visible,
                                                                 onCancel,
                                                                 onSuccess,
                                                             }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);

            // 转换百分比为小数
            const submitData = {
                ...values,
                rate: values.rate / 100,
            };

            await createStaffRating(submitData);
            message.success('创建成功');
            onSuccess();
            form.resetFields();
        } catch (error) {
            message.error('创建失败');
            console.error('创建评级失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    return (
        <Modal
            title="添加评级"
            open={visible}
            onOk={() => form.submit()}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
            >
                <Form.Item
                    label="评级名称"
                    name="name"
                    rules={[{ required: true, message: '请输入评级名称' }]}
                >
                    <Input placeholder="例如：传奇、万古流芳、超凡入圣、冠绝一世" />
                </Form.Item>

                <Form.Item
                    label="描述"
                    name="description"
                >
                    <Input placeholder="请输入评级描述" />
                </Form.Item>

                <Form.Item
                    label="考核规则"
                    name="rules"
                    rules={[{ required: true, message: '请输入考核规则' }]}
                >
                    <TextArea
                        rows={4}
                        placeholder="请输入详细的考核规则和标准"
                    />
                </Form.Item>

                <Form.Item
                    label="适用范围"
                    name="scope"
                    rules={[{ required: true, message: '请选择适用范围' }]}
                >
                    <Select placeholder="请选择适用范围">
                        <Option value="ONLINE">线上陪玩</Option>
                        <Option value="OFFLINE">线下陪玩</Option>
                        <Option value="BOTH">线上线下通用</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    label="分红比例"
                    name="rate"
                    rules={[{ required: true, message: '请输入分红比例' }]}
                >
                    <InputNumber
                        min={1}
                        max={100}
                        formatter={value => `${value}%`}
                        parser={value => value!.replace('%', '')}
                        placeholder="请输入1-100之间的数字"
                        style={{ width: '100%' }}
                    />
                </Form.Item>

                <Form.Item
                    label="状态"
                    name="status"
                    initialValue="ACTIVE"
                >
                    <Select>
                        <Option value="ACTIVE">启用</Option>
                        <Option value="INACTIVE">停用</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    label="排序"
                    name="sortOrder"
                    initialValue={0}
                >
                    <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateRatingModal;
