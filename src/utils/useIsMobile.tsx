import { useEffect, useState } from 'react';

/**
 * 简单可靠的移动端判断：宽度 < 768 视为 mobile
 * - 不依赖 UA
 * - 支持窗口变化
 */
export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < breakpoint;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

        const handler = () => setIsMobile(mql.matches);

        handler();

        // 兼容性处理
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        } else {
            // @ts-ignore
            mql.addListener(handler);
            // @ts-ignore
            return () => mql.removeListener(handler);
        }
    }, [breakpoint]);

    return isMobile;
}
