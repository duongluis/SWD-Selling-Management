import { useMemo, useState } from 'react';

/**
 * @param data        - mảng gốc
 * @param searchKeys  - các field để search, vd: ['name','phone','id']
 * @param filterKey   - field để filter chip, vd: 'status'
 */
export function useSearch(data, searchKeys = ['name'], filterKey = null) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all'); // 'all' | bất kỳ value nào

    const result = useMemo(() => {
        let out = data || [];

        // Filter chip
        if (filter && filter !== 'all' && filterKey) {
            out = out.filter(item => {
                const val = item[filterKey] || '';
                return val === filter;
            });
        }

        // Search text
        const q = query.trim().toLowerCase();
        if (q) {
            out = out.filter(item =>
                searchKeys.some(key => {
                    const val = String(item[key] || '').toLowerCase();
                    return val.includes(q);
                })
            );
        }

        return out;
    }, [data, query, filter, filterKey, searchKeys]);

    const clearSearch = () => { setQuery(''); setFilter('all'); };

    return {
        query, setQuery,
        filter, setFilter,
        result,
        clearSearch,
        isEmpty: result.length === 0,
    };
}