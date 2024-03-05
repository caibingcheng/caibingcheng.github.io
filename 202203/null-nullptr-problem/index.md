# NULL和nullptr实际问题分析


在C++中推荐使用`nullptr`代表空指针，虽然我一直坚持这个原则，但是实际开发中没有遇到非`nullptr`不可的情况，直到写了以下代码（已脱敏）：

<!--more-->

```C++
template <typename F, typename... Args>
using func_t = typename std::result_of<F(Args...)>::type;

template <typename F, typename... Args,
          typename Rp = func_t<F, Args...>,
          bool is_void_v = std::is_void<Rp>::value>
inline Rp call(F &&func, Args &&...args)
{
    //...
}
```

## 问题

这段代码的目的是期望通过`call`调用一些方法，然后可以对这些方法做一些其他处理。然后假设如此调用：

```C++
typedef void* handle;
int AlgoProcess(handle p)
{
    //processing
    return 0;
}

call(AlgoProcess, NULL);
```

编译时会报错，提示`matching function`。可能有如下报错信息：

```
no type named 'type' in 'std::result_of<int (&(long))(void *)>'
```

关注以上报错信息，可以知道是`result_of`匹配报错，这里将输入参数`NULL`解析为了`long`类型，但是`AlgoProcess`需求参数是`void *`类型，所以类型不匹配，又因为没有其他匹配项了，所以编译报错(SFINAE)。

只需要将`NULL`改成`nullptr`就可以编译通过，因为`nullptr`是可以匹配指针的。

```C++
call(AlgoProcess, nullptr);
```

那么新问题来了，到底应该不应该为用户匹配一个`NULL`的版本呢？

因为在大型项目里面无法保证每个用户都会按照你的需要输入`nullptr`。不过幸好这是编译期的错误，对产品的影响不大。

如果要匹配一个`NULL`版本应该怎么做？此时需要考虑到和`long`的输入类型做区分。

## nullptr原理

`NULL`的原理好理解，是一个宏，值是`void* (0)`或者0。

`nullptr`的实现原理是什么？超出了我的能力范围，找到过一些用类模拟`nullptr`的资料，但是都不太符合我的要求，以下文章讲的应该是比较正确的（看不懂...）。总结一句话就是`nullptr`依赖编译器的词法、语法和语义支持。

[nullptr底层实现原理是什么？ - 蓝色的回答 - 知乎](https://www.zhihu.com/question/67751356/answer/263136072)

## 结论

小心使用`NULL`，因为`NULL`可能会被解析为整形而不是指针类型，因而导致与指针类型不匹配等问题。那么，如果想表示空指针，就坚持使用`nullptr`吧～（Effective C++中也有此推荐。）

