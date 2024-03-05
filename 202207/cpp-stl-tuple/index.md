# STL-tuple源码阅读


`std::tuple`是C++11开始支持的一个编译期确定长度的, 可支持任意参数类型的容器, 相当于是`std::pair`的扩展, 平常只使用过它, 却没有了解其实现原理.


<!--more-->


> Class template std::tuple is a fixed-size collection of heterogeneous values. It is a generalization of std::pair.

## TinyTuple

我们先来实现一个简易版的`std::tuple` - `TinyTuple`, 支持任意参数类型和`get<N>`方法(先不考虑`get<Type>`).

遇到的第一个问题是, 如何将任意数量的, 不同参数类型的值打包起来? 一种想法是, 用一块动态内存来存, 每输入一个参数`var`, 动态内存就扩大`sizeof(var)`, 然后记下当前位置. 在获取的时候, 根据`N`就能确定内存的位置, 不过这时候用户还需要输入数据类型才能正确获取值, get接口可能就变成了`get<N, Type>`, 相当于是一个array any了. 能不能省略`Type`输入呢? 参考我们上一篇[STL-any源码阅读](https://www.bbing.com.cn/202207/cpp-stl-any/), 是不是用一个类似`AnyData`的模板类来保存数据类型? 可能不太好使, 因为get方法不带type类型的话, `AnyData`似乎也束手无策(对应的问题是, 返回值如何统一?).

`std::tuple`是借助"继承可变参模板类"来实现的, 看看简化版的`TinyTuple`如何实现:

定义如下:
```C++
template <typename ...Tps>
class TinyTuple;
```

现在"偏特化"模板, 提取第一个参数的类型, 并以此递归下去:
```C++
template <typename Tp, typename ...Tps>
class TinyTuple<Tp, Tps...> : public TinyTuple<Tps...>
{
public:
    TinyTuple(const Tp& val, Tps&& ...params) : TinyTuple<Tps...>(std::forward<Tps>(params)...)
    {
        value = val;
    }

    Tp get_value() const
    {
        return value;
    }
private:
    Tp value;
};
```

注意到构造函数`TinyTuple(Tp && val, Tps && ...params) : TinyTuple<Tps...>(std::forward<Tps>(params)...)`的原地构造是递归的, 在函数体内部才赋值当前值, 因此`TinyTuple`参数的初始化(复制)顺序是从右往左的.

参数为空就是递归的终止条件:
```C++
template <>
class TinyTuple <>
{
};
```

对于一个实例`TinyTuple<Type1, Type2, ..., TypeN> tuple(var1, var2, ..., varN)`可以得到其内存排列如下:

!["TinyTuple内存排列"](https://bu.dusays.com/2022/10/23/635554d29ba1f.png "TinyTuple内存排列")

以上, 我们将`TinyTuple`的值和类型保存了下来, 如何获取值呢?

注意到, 我们实例化的`TinyTuple`对象, 实际上是一个子类. 如下:

```C++
TinyTuple<Type1, Type2, ..., TypeN> tuple(var1, var2, ..., varN);
```
其父类类型是:
```C++
TinyTuple<Type2, ..., TypeN>
TinyTuple<..., TypeN>
...
TinyTuple<TypeN>
```

因此, 可以向上转换成对应的父类, 该父类的`value`成员就是我们需要获取的值. 那么可以定义如下接口:

```C++
template<size_t N, typename ...Tps>
auto get(const TinyTuple<Tps...> &ttuple)
{
    using tuple_t = Elements<N, Tps...>::tuple_t;
    return static_cast<const tuple_t &>(ttuple).get_value();
}
```

通过`Elements<N, Tps...>`可以获取第N阶父类的类型. 然后将tuple转换成对应父类类型访问`value`即可.

`Elements`的实现方法类似`TinyTuple`, 不过是通过`N`递归来获取第N阶父类类型:

```C++
template <size_t N, typename ...Tps>
struct Elements;

template <size_t N>
struct Elements<N> {
    static_assert(N > 0, "Index overflow");
};

template <size_t N, typename Tp, typename ...Tps>
struct Elements<N, Tp, Tps...> : public Elements <N - 1, Tps...>{
};

template <typename Tp, typename ...Tps>
struct Elements<0, Tp, Tps...>
{
    using tuple_t = TinyTuple<Tp, Tps...>;
};
```

那么, 可以这样使用:
```C++
int main() {
    TinyTuple<int, char, double, const char*> ttuple{1, 'a', 0.2, "abc"};

    std::cout << get<0>(ttuple) << std::endl;
    std::cout << get<1>(ttuple) << std::endl;
    std::cout << get<2>(ttuple) << std::endl;
    std::cout << get<3>(ttuple) << std::endl;
}
```

完整代码: [https://gcc.godbolt.org/z/v3bYnxWrP](https://gcc.godbolt.org/z/v3bYnxWrP)

## std::tuple

`std::tuple`的实现比以上的`TinyTuple`复杂得多, 但是核心思想还是类似的, `std::tuple`的类间关系如下:

!["std::tuple 继承关系"](https://bu.dusays.com/2022/10/23/635554d3599b9.png "std::tuple 继承关系")

### _Head 和 _Head_base

最底层部分是`_Head`这个"类", `_Head`是什么? 我们看下面的定义就可以知道了, `_Head`会是用户需要存储的一种类型:

```C++
template<size_t _Idx, typename _Head>
struct _Head_base<_Idx, _Head, true>
{
    //...
}
```

比如`std::tuple<int, double>`, 那么`_Head`就是`int`和`double`.

`_Head_base`和`_Head`的关系有两种实现方法, 一种是`is a`, 一种是`use a`, 如下:
```C++
// is a
template<size_t _Idx, typename _Head>
struct _Head_base<_Idx, _Head, true>
: public _Head
{
    //...
}

// use a
template<size_t _Idx, typename _Head>
struct _Head_base<_Idx, _Head, true>
{
    //...
    [[__no_unique_address__]] _Head _M_head_impl;
}
```

以`use a`关系为例, `_Head_base`偏特化了两个实现, 如下:

```C++
template<size_t _Idx, typename _Head>
struct _Head_base<_Idx, _Head, true>
{
    //...
    [[__no_unique_address__]] _Head _M_head_impl;
}

template<size_t _Idx, typename _Head>
struct _Head_base<_Idx, _Head, false>
{
    //...
    _Head _M_head_impl;
};
```

以上两个模板在实现上没有任何区别, 仅成员变量`_M_head_impl`的声明不同. 那么, 现在需要关注`__no_unique_address__`属性是什么意思. `__no_unique_address__`属性如其字面意思, 描述的是它修饰的东西没有独立的地址. 比如对一个空类, 一般来说会占用1B空间, 但是经过`__no_unique_address__`修饰后, 可以不占用额外的地址空间(0B). 什么时候会选中这个属性? 这时候需要关注`_Head_base`的第三个模板参数什么时候会特化为`true`, 什么时候特化为`false`.

```C++
template<typename _Tp>
struct __is_empty_non_tuple : is_empty<_Tp> { };

// Using EBO for elements that are tuples causes ambiguous base errors.
template<typename _El0, typename... _El>
struct __is_empty_non_tuple<tuple<_El0, _El...>> : false_type { };

// Use the Empty Base-class Optimization for empty, non-final types.
template<typename _Tp>
using __empty_not_final
= __conditional_t<__is_final(_Tp), false_type,
            __is_empty_non_tuple<_Tp>>;

template<size_t _Idx, typename _Head,
    bool = __empty_not_final<_Head>::value>
struct _Head_base;
```

如上, `_Head_base`的第三个模板参数特化为`false`的情况有:

1. `_Head`是用`final`修饰的类
2. `_Head`是`tuple`类型
3. `_Head`不是`empty`的

`_Head_base`的第三个模板参数特化为`true`的情况有:

1. `_Head`没有用`final`修饰并且不是`tuple`类型, 并且是`empty`的

[is_empty](https://en.cppreference.com/w/cpp/types/is_empty)描述如下:

> If T is an empty type (that is, a non-union class type with no non-static data members other than bit-fields of size 0, no virtual functions, no virtual base classes, and no non-empty base classes), provides the member constant value equal to true. For any other type, value is false.

以上, 我认为偏特化两种`_Head_base`的作用是为了将少无用内存的消耗.

### _Tuple_impl

`_Tuple_impl`是做可变参模板递归的类, 其实现类似于`TinyTuple`, 定义如下:

```C++
template<size_t _Idx, typename... _Elements>
struct _Tuple_impl;
```

偏特化为两个实现, 一个是通俗的递归过程:

```C++
template<size_t _Idx, typename _Head, typename... _Tail>
struct _Tuple_impl<_Idx, _Head, _Tail...>
: public _Tuple_impl<_Idx + 1, _Tail...>,
    private _Head_base<_Idx, _Head>
```

一个是递归终止过程:

```C++
template<size_t _Idx, typename _Head>
struct _Tuple_impl<_Idx, _Head>
: private _Head_base<_Idx, _Head>
```

递归的`_Tuple_impl`如何实现的? 先来关注其构造函数:

```C++
typedef _Tuple_impl<_Idx + 1, _Tail...> _Inherited;
typedef _Head_base<_Idx, _Head> _Base;

//...

explicit constexpr
_Tuple_impl(const _Head& __head, const _Tail&... __tail)
: _Inherited(__tail...), _Base(__head)
{ }
```

同`TinyTuple`的内存排列, `_Tuple_impl`的排列也是从右往左的元素按照地址从高到低排列.

如何获取元素呢? `_Tuple_impl`充分借用了父子类的特性, 很值得学习和实践:

```C++
static constexpr const _Head&
_M_head(const _Tuple_impl& __t) noexcept { return _Base::_M_head(__t); }

static constexpr const _Inherited&
_M_tail(const _Tuple_impl& __t) noexcept { return __t; }
```

`_M_head`可以获取`tuple`元素的值, `_M_tail`可以获取余下的"队列".

怎么做到的? 因为`_Base::_M_head`会将`_Tuple_impl`向上转换为`_Head_base`类, 这也是`_Tuple_impl`的父类. `_M_tail`则是通过返回值的类型, 将`_Tuple_impl`转换为`_Inherited`这个父类, 因此可以拿到余下的元素类. 递归终止类的实现类似, 此处就不继续看了.

这里涉及到多继承向上转换的隐式过程, 如下demo来验证:
```C++
#include <iostream>

class B1 {
public:
    int val1;
};
class B2 {
public:
    int val2;
};

class D : public B1, public B2 {};

int main() {
    D d;
    B1 &b1 = d;
    B2 &b2 = d;
    
    std::cout << &b1 << "  " << &b2 << std::endl;
}
```

输出是`0x7fff2ac0bf38  0x7fff2ac0bf3c`, `b1`和`b2`是不同的内存区域, 差值是`4B`, `b2`在高地址, `b1`在低地址, 实际上在编译期就已经计算好两个`base`的偏移了, 他们的内存布局就对应着相应的Base类的内存布局.

### tuple

以上我们学习了三个数据类型, 最基础的是`Head`, 它表示的是用户需要的元素的类型, 比如`int`, `double`一类；然后是`Head_base`, 相当于是`Head`的封装, 与`Head`一般是`use`的关系. 再是`_Tuple_impl`, 这是一个变参模板递归的类, 采用双继承的结构, 一个父类是自身的递归类, 一个是 `Head_base`类. 接下来就看看`tuple`类型, `tuple`有几种特化类型, 如下:

基础类型:
```C++
template<typename... _Elements>
class tuple : public _Tuple_impl<0, _Elements...>
{
    //...
}
```

空数据:
```C++
template<>
class tuple<>
```

2个元素的`tuple`:
```C++
template<typename _T1, typename _T2>
class tuple<_T1, _T2> : public _Tuple_impl<0, _T1, _T2>
```

因为有`_Tuple_impl`的辅助, `tuple`的实现就不需要关系数据如何保存了, `tuple`类更多的是关心如何构造, 如何复制之类, 暂时就不展开看了.

### get

访问`tuple`元素的方法之一是通过`get`方法, 一般接口如下, 我们需要关注两个实现`__tuple_element_t`和`__get_helper`.

```C++
template<size_t __i, typename... _Elements>
constexpr const __tuple_element_t<__i, tuple<_Elements...>>&
get(const tuple<_Elements...>& __t) noexcept
{ return std::__get_helper<__i>(__t); }

template<size_t __i, typename... _Elements>
constexpr const __tuple_element_t<__i, tuple<_Elements...>>&&
get(const tuple<_Elements...>&& __t) noexcept
{
    typedef __tuple_element_t<__i, tuple<_Elements...>> __element_type;
    return std::forward<const __element_type>(std::__get_helper<__i>(__t));
}
```

`__tuple_element_t`的实现见[cppreference-tuple_element](https://en.cppreference.com/w/cpp/utility/tuple/tuple_element), 和`TinyTuple`中`Elements`的实现基本一致, 这里也不展开了. 最终是通过`__get_helper`获取元素的, 实现如下:

```C++
template<size_t __i, typename _Head, typename... _Tail>
constexpr const _Head&
__get_helper(const _Tuple_impl<__i, _Head, _Tail...>& __t) noexcept
{ return _Tuple_impl<__i, _Head, _Tail...>::_M_head(__t); }
```

这里的trick也比较有意思, 虽然` std::__get_helper<__i>(__t)`传入的参数是"最"子类`tuple`, 但是`__get_helper`接收的是某个父类`_Tuple_impl`作为形参, 这时候`size_t __i`这个模板参数就起到作用了, 因为`__get_helper<__i>`可以直接匹配对应的`_Tuple_impl`类型, `tuple`作为`__get_helper`的参数入参后, 就会匹配并转换成`_Tuple_impl<__i, _Head, _Tail...>`父类, 然后通过`_M_head`接口获取元素的值即可.

在C++14后, `get`还支持将类型作为模板参数, 比如`get<int>(tuple)`, 可以想想怎么实现. 比如参考`Elements`的做法, 将`tuple`的类型列表展开后, 匹配到对应的类型就返回对应的`index`, 一种实现如下:

```C++
template <size_t N, typename Tp, typename Head, typename ...Tps>
constexpr size_t ElementsIndex()
{
    if constexpr (std::is_same<Tp, Head>::value)
        return N;
    else
        return ElementsIndex<N + 1, Tp, Tps...>();
}

template <size_t N, typename Tp, typename Head>
constexpr size_t ElementsIndex()
{
    if constexpr (std::is_same<Tp, Head>::value)
        return N;
    static_assert(std::is_same<Tp, Head>::value, "No Matched Type");
}
```

将这个更新加在`TinyTuple`可以扩展`get`方法, 如下使用:

```C++
std::cout << get<0>(ttuple) << std::endl;
std::cout << get<1>(ttuple) << std::endl;
std::cout << get<2>(ttuple) << std::endl;
std::cout << get<3>(ttuple) << std::endl;
std::cout << get<char>(ttuple) << std::endl;
std::cout << get<double>(ttuple) << std::endl;
```

在gcc是这样实现的:
```C++
template <typename _Tp, typename... _Types>
constexpr const _Tp&
get(const tuple<_Types...>& __t) noexcept
{
    constexpr size_t __idx = __find_uniq_type_in_pack<_Tp, _Types...>();
    static_assert(__idx < sizeof...(_Types),
    "the type T in std::get<T> must occur exactly once in the tuple");
    return std::__get_helper<__idx>(__t);
}
```
关注`__find_uniq_type_in_pack`:
```C++
template<typename _Tp, typename... _Types>
constexpr size_t
__find_uniq_type_in_pack()
{
    constexpr size_t __sz = sizeof...(_Types);
    constexpr bool __found[__sz] = { __is_same(_Tp, _Types) ... };
    size_t __n = __sz;
    for (size_t __i = 0; __i < __sz; ++__i)
{
    if (__found[__i])
    {
        if (__n < __sz) // more than one _Tp found
    return __sz;
        __n = __i;
    }
}
    return __n;
}
```

此处对变参模板使用得很灵活, `__is_same(_Tp, _Types) ...`用法值得学习(相当于一个参数固定, 另一个参数是可变参).

### tie

`tuple`的另一个功能是支持解包, 通过`tie`实现. `tie`怎么做的? 先看看源码:

```C++
template<typename... _Elements>
constexpr tuple<_Elements&...>
tie(_Elements&... __args) noexcept
{ return tuple<_Elements&...>(__args...); }
```

相当于是返回了一个类型是引用类型的`tuple`, 那么我们可以给`TinyTuple`加上类似的功能, 其中的`tie`实现如下:

```C++
template<typename ...Tps>
TinyTuple<Tps &...> tie(Tps &...args)
{
    return TinyTuple<Tps &...>(args...);
}
```

需要再实现`TinyTuple`的赋值操作:

```C++
template<typename...> friend class TinyTuple;

template <typename Head, typename ...Args>
TinyTuple<Tp, Tps...> &operator=(const TinyTuple<Head, Args...> &t)
{
    this->value = t.value;
    TinyTuple<Tps...>(*this) = TinyTuple<Args...>(t);

    return *this;
}
```

此处的`TinyTuple<Tps...>(*this) = TinyTuple<Args...>(t);`不需要递归终止条件, 因为最终的`TinyTuple<Tps...>`会退化为`TinyTuple<>`. 那么, 在`TinyTuple`里面可以这样使用`tie`:

```C++
int p1;
char p2;
double p3;
const char* p4;
tie(p1, p2, p3, p4) = ttuple;

std::cout << p1 << std::endl;
std::cout << p2 << std::endl;
std::cout << p3 << std::endl;
std::cout << p4 << std::endl;
```

