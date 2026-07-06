---
id: "k101"
slug: "react-hooks-最佳实践与常见陷阱"
title: "React Hooks 最佳实践与常见陷阱"
date: "2026-07-06"
category: "frontend"
summary: "React Hooks 自 React 16.8 引入以来，已成为函数组件中管理状态和副作用的核心工具。本文整理 Hooks 的最佳实践和常见陷阱，帮助开发者写出更可靠、更易维护的组件。 1. 只在 React 函数组件或自定义 Hook 中调用 Hooks      不要在普通 JavaScrip..."
format: "md"
---

# React Hooks 最佳实践与常见陷阱

React Hooks 自 React 16.8 引入以来，已成为函数组件中管理状态和副作用的核心工具。本文整理 Hooks 的最佳实践和常见陷阱，帮助开发者写出更可靠、更易维护的组件。

## 一、核心原则

1. **只在 React 函数组件或自定义 Hook 中调用 Hooks**  
   不要在普通 JavaScript 函数中调用，否则破坏 Hooks 的调用顺序规则。

2. **只在顶层调用 Hooks**  
   不要在循环、条件判断或嵌套函数中调用，确保每次渲染时调用顺序一致。

3. **遵守 ESLint 插件规则**  
   使用 `eslint-plugin-react-hooks` 的 `exhaustive-deps` 规则，自动检查依赖项。

## 二、最佳实践

### 1. 状态管理

- 使用 `useState` 管理局部状态，避免将多个不相关的状态合并为一个对象。
- 对于复杂状态逻辑，考虑使用 `useReducer` 替代多个 `useState`。

### 2. 副作用处理

- `useEffect` 用于同步非 React 系统（如 DOM、网络请求），不要用它来处理事件或数据转换。
- 将不相关的副作用拆分到不同的 `useEffect` 中，提高可读性。

### 3. 自定义 Hook

- 将可复用的状态逻辑提取为自定义 Hook，遵循“一个 Hook 只做一件事”的原则。
- 自定义 Hook 应返回状态和更新函数，保持接口清晰。

### 4. 性能优化

- 使用 `useMemo` 缓存计算结果，仅在依赖项变化时重新计算。
- 使用 `useCallback` 缓存函数引用，避免传递给子组件时的不必要重渲染。
- 对于大列表或频繁更新，配合 `React.memo`、`useMemo`、`useCallback` 使用。

### 5. 引用管理

- `useRef` 用于保存可变值或 DOM 引用，不触发重渲染。
- 使用 `useRef` 访问 DOM 元素、保存定时器 ID 或存储上一次的值。

### 6. 测试友好

- 将副作用逻辑提取到自定义 Hook 中，便于单独测试。
- 使用 `@testing-library/react-hooks` 测试自定义 Hook 的行为。

## 三、常见陷阱

### 1. 无限循环

`useEffect` 中的依赖项不断变化导致循环更新。

```jsx
// 错误示例：依赖项包含 state，导致无限循环
useEffect(() => {
  fetchData(id);
}, [id, fetchData]); // 若 fetchData 每次渲染都创建新引用

// 正确：将函数移入 effect 内部或使用 useCallback 包装
useEffect(() => {
  const fetchData = async () => {
    const res = await fetch(`/api/${id}`);
    setData(await res.json());
  };
  fetchData();
}, [id]);
```

### 2. 闭包陷阱

回调或 effect 捕获了旧的 state，导致逻辑错误。

```jsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // 这里始终读取到初始 count = 0
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // 空依赖，只运行一次

  return <div>{count}</div>;
}
```

**解决方案**：使用函数式更新 `setCount(c => c + 1)` 或添加 `count` 到依赖数组。

### 3. 过度依赖 `useEffect`

许多副作用可以被事件处理器替代，减少不必要的 effect。

```jsx
// 使用事件处理器代替 useEffect 监听搜索
function Search() {
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    // 在提交时执行搜索
    fetchResults(query);
  };

  return <input value={query} onChange={e => setQuery(e.target.value)} onBlur={handleSearch} />;
}
```

### 4. 缺失依赖项

忽略 `exhaustive-deps` 警告可能导致过时闭包。

```jsx
// ESLint 会警告缺少依赖项
useEffect(() => {
  doSomething(a, b);
}, [a]); // 缺少 b

// 正确：列出所有依赖项
useEffect(() => {
  doSomething(a, b);
}, [a, b]);
```

### 5. 在渲染阶段执行副作用

在组件体或自定义 Hook 的顶层执行副作用（如 API 请求）会导致重复调用。

```jsx
// 错误：每次渲染都会请求
function User({ id }) {
  const [user, setUser] = useState(null);
  fetch(`/api/${id}`).then(r => r.json()).then(setUser); // 副作用在渲染阶段

  return <div>{user?.name}</div>;
}

// 正确：使用 useEffect
useEffect(() => {
  fetch(`/api/${id}`)
    .then(r => r.json())
    .then(setUser);
}, [id]);
```

### 6. 滥用 `useLayoutEffect`

`useLayoutEffect` 在浏览器绘制前同步执行，阻塞视觉更新，仅在需要测量布局时使用。默认优先使用 `useEffect`。

## 四、调试技巧

- 使用 React DevTools 的 Profiler 检查不必要的重渲染。
- 在 effect 中添加日志，确认执行时机和依赖变化。
- 使用 `why-did-you-render` 库检测意外重渲染。

## 五、参考资源

- [React 官方 Hooks 文档](https://reactjs.org/docs/hooks-intro.html)
- [Overreacted: A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/)
- [React Hooks: 常见陷阱与最佳实践](https://kentcdodds.com/blog/react-hooks-pitfalls)

---

*文档创建于 2025年，适合 React 16.8+ 项目参考。*