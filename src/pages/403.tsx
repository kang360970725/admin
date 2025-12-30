import React from 'react';
import { Result, Button } from 'antd';

export default () => (
    <Result
        status="403"
        title="403"
        subTitle="无权限访问该页面"
        extra={
            <Button type="primary" onClick={() => (window.location.href = '/')}>
                返回首页
            </Button>
        }
    />
);
