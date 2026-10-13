// src/utils/env.ts
/**
 * 环境工具函数
 */

// 获取当前环境
export const getEnv = (): string => {
    return process.env.UMI_ENV || 'development';
};

// 环境判断函数
export const isDev = (): boolean => getEnv() === 'development';
export const isTest = (): boolean => getEnv() === 'test';
export const isPre = (): boolean => getEnv() === 'pre';
export const isProd = (): boolean => getEnv() === 'production';

// 获取 API 基础地址
export const getApiBase = (): string => {
    return process.env.API_BASE || 'http://127.0.0.1:3000';
};

// 获取应用名称
export const getAppName = (): string => {
    return process.env.APP_NAME || '蓝猫陪玩管理系统';
};

// 日志环境信息
export const logEnvInfo = (): void => {
    if (isDev()) {
        // console.log(`🚀 当前环境: ${getEnv()}`);
        // console.log(`🔗 API地址: ${getApiBase()}`);
        console.log(`📱 应用名称: ${getAppName()}`);
    }
};
