# STL-any源码阅读


`std::any`是C++17定义的支持任意可拷贝类型的标准容器. 描述如下:

> The class any describes a type-safe container for single values of any copy constructible type.

<!--more-->

用法如下, 当然也支持复制, 拷贝构造一类:

```C++
std::any var;
var = 1;
var = "1";
var = nullptr;
```

## 实现TinyAny

按照基本功能, `std::any`可以支持存放任意类型, 我们可以先尝试实现一个简单版本的`TinyAny`, 看看如果要写一个`any`类型, 应该怎么写. 简化起见, 就不需要考虑类型安全, 也不关注`copy constructible`, 实现如下(实际上是看完`std::any`才想到这种实现的, 核心在`AnyData`):

```C++
#include <type_traits>
#include <utility>

class TinyAny
{
    /**
    ** AnyData 类保存了输入数据的类型
    **/
    template<typename Tp>
    class AnyData {
    public:
        static void create(void **data, Tp && val)
        {
            *data = new Tp(std::forward<Tp>(val));
        }

        static void deleter(void *data)
        {
            auto ptr = static_cast<Tp *>(data);
            delete ptr;
        }
    };
public:
    /**
    ** std::decay_t<Tp__> 用于将const/reference等描述退化, 因为保存类型是不需要这些特性的
    ** deleter 指向AnyData<Tp>::deleter, 这样就保存了输入数据的类型了
    **/
    template <typename Tp__, typename Tp = std::decay_t<Tp__>>
    TinyAny(Tp__&& val) : deleter(AnyData<Tp>::deleter) {
        AnyData<Tp>::create(&data, std::forward<Tp>(val));
    }

    /**
    ** deleter的时候就可以调用对应类型的析构函数
    **/
    ~TinyAny() {
        deleter(data);
        data = nullptr;
    }

    // 采用swap copy
    template <typename Tp>
    TinyAny &operator = (Tp&& val)
    {
        TinyAny temp{std::forward<Tp>(val)};
        swap(std::move(temp));
        return *this;
    }

    template <typename Tp>
    Tp get()
    {
        return *static_cast<Tp*>(data);
    }
private:
    TinyAny &swap(TinyAny && another) noexcept
    {
        std::swap(data, another.data);
        std::swap(deleter, another.deleter);
        return *this;
    }

private:
    void *data;
    void (* deleter)(void *data);
};
```

那么, 可以这样使用:
```C++
int main() {
    TinyAny var{123};
    std::cout << var.get<int>() << std::endl;
    var = std::string("123");
    std::cout << var.get<std::string>() << std::endl;
    var = 0.123f;
    std::cout << var.get<float>() << std::endl;
    var = 'a';
    std::cout << var.get<char>() << std::endl;
    var = "abc";    // "abc"是const char*类型, 在TinyAny中会退化成char*, 因此, 保存的是指针
    std::cout << var.get<const char *>() << std::endl;
    var = "def";
    std::cout << var.get<const char *>() << std::endl;
}
```

如开头所说, 它不是一个类型安全的容器, 所以也可能被这样误用, 编译期是不会报错的:
```C++
var = "defg";
std::cout << var.get<int>() << std::endl;
```

## std::any源码

下面来看标准库的实现:

```C++
class any
{
    //...
}
```

首先注意到, `std::any`不是一个模板类, 应对我们的需求, 它也不能是一个模板类.

### _Storage

接下来定义了一个`_Storage`联合体:
```C++
// Holds either pointer to a heap object or the contained object itself.
union _Storage
{
    constexpr _Storage() : _M_ptr{nullptr} {}

    // Prevent trivial copies of this type, buffer might hold a non-POD.
    _Storage(const _Storage&) = delete;
    _Storage& operator=(const _Storage&) = delete;

    void* _M_ptr;
    aligned_storage<sizeof(_M_ptr), alignof(void*)>::type _M_buffer;
};
```

不难猜到, 其作用就是用来存放数据的, 有`_M_ptr`和`_M_buffer`两个选项, 先看看`aligned_storage`实现:

```C++
// other transformations [4.8].
template<std::size_t _Len, std::size_t _Align>
struct aligned_storage
{ 
    union type
    {
unsigned char __data[_Len];
struct __attribute__((__aligned__((_Align)))) { } __align; 
    };
};
```

以上说明, `_M_buffer`是栈上的一块内存, 大小是`sizeof(void*)`, 并且做了内存对齐(TODO: 有什么用? 哪些地方需要对齐?). 总之, 现在可以知道`std::any`的数据可能存放在栈上, 也可能存放在堆上, 对于小内存(比如`sizeof(void*)`以下), 是存在栈上的.

### _Manager

接下来根据类型的size, 决定了`_Manager`的类型, 分别有`_Manager_internal`和`_Manager_external`, 一个管理小内存, 一个管理堆内存.
```C++
template<typename _Tp, typename _Safe = is_nothrow_move_constructible<_Tp>,
        bool _Fits = (sizeof(_Tp) <= sizeof(_Storage))
            && (alignof(_Tp) <= alignof(_Storage))>
    using _Internal = std::integral_constant<bool, _Safe::value && _Fits>;

template<typename _Tp>
    struct _Manager_internal; // uses small-object optimization

template<typename _Tp>
    struct _Manager_external; // creates contained object on the heap

template<typename _Tp>
    using _Manager = conditional_t<_Internal<_Tp>::value,
                    _Manager_internal<_Tp>,
                    _Manager_external<_Tp>>;
```

`_Manager`的定义在哪? 我们往下看, 以`_Manager_internal`举例:
```C++
// Manage in-place contained object.
template<typename _Tp>
    struct _Manager_internal
    {
static void
_S_manage(_Op __which, const any* __anyp, _Arg* __arg);

template<typename _Up>
    static void
    _S_create(_Storage& __storage, _Up&& __value)
    {
    void* __addr = &__storage._M_buffer;
    ::new (__addr) _Tp(std::forward<_Up>(__value));
    }

template<typename... _Args>
    static void
    _S_create(_Storage& __storage, _Args&&... __args)
    {
    void* __addr = &__storage._M_buffer;
    ::new (__addr) _Tp(std::forward<_Args>(__args)...);
    }
    };
```

我认为`_Manager`的实现是很有意思的, 只包含了静态成员函数, 但是因为是模板类, 因此匹配之后是可以包含类型信息的, 又因为是静态成员函数, 就可以用函数指针指向这些静态成员函数, 从而又可以隐藏类型信息, 以上`TinyAny`实现的主要参考点即在这里.

因为`_Manager_internal`指向的是小内存, 因此这里使用的是[placement new](https://www.bbing.com.cn/202206/cpp_placementnew_allocator/#placement-new), 直接在给定的内存上构造, 在前面的文章中, 已经介绍过其用法了(TODO: 原理还不知道), 此处不再叙述.

`_Manager_external`同理, 只不过是在堆上分配内存和构造的:
```C++
// Manage external contained object.
template<typename _Tp>
    struct _Manager_external
    {
static void
_S_manage(_Op __which, const any* __anyp, _Arg* __arg);

template<typename _Up>
    static void
    _S_create(_Storage& __storage, _Up&& __value)
    {
    __storage._M_ptr = new _Tp(std::forward<_Up>(__value));
    }
template<typename... _Args>
    static void
    _S_create(_Storage& __storage, _Args&&... __args)
    {
    __storage._M_ptr = new _Tp(std::forward<_Args>(__args)...);
    }
    };
};
```

### 构造

以下`_Decay`的定义也是实现`any`的核心, 通过`decay`, 可以将一些复杂属性退化, 比如`const`/`&`等等, 这将帮助我们使用`_Manager`保存基本的数据类型:
```C++
template<typename _Tp, typename _Decayed = decay_t<_Tp>>
    using _Decay = enable_if_t<!is_same<_Decayed, any>::value, _Decayed>;
```

以其中一构造举例:
```C++

/// Construct with a copy of @p __value as the contained object.
template <typename _ValueType, typename _Tp = _Decay<_ValueType>,
        typename _Mgr = _Manager<_Tp>,
            __any_constructible_t<_Tp, _ValueType&&> = true,
        enable_if_t<!__is_in_place_type<_Tp>::value, bool> = true>
    any(_ValueType&& __value)
    : _M_manager(&_Mgr::_S_manage)
    {
    _Mgr::_S_create(_M_storage, std::forward<_ValueType>(__value));
    }
```

首先拿到了输入数据的退化类型`typename _Tp = _Decay<_ValueType>`, 然后根据其类型size选择了对应的`_Manager`, 再接下来判断其数据类型是否可拷贝构造或者赋值`__any_constructible_t<_Tp, _ValueType&&> = true`, `__any_constructible_t`定义如下, 是一个借助`enable_if`实现的SFINAE.

```C++
template <typename _Res, typename _Tp, typename... _Args>
using __any_constructible =
    enable_if<__and_<is_copy_constructible<_Tp>,
            is_constructible<_Tp, _Args...>>::value,
        _Res>;

template <typename _Tp, typename... _Args>
using __any_constructible_t =
    typename __any_constructible<bool, _Tp, _Args...>::type;
```

`__is_in_place_type`先不关注了, 这是用来解决一些类型匹配问题的模板, 在C++17标准中, 模板是可以作为函数参数的. 匹配通过后, 在构造函数中初始化了`_M_manager(&_Mgr::_S_manage)`和构造了数据的值(是拷贝的).

其他各种构造函数则是通过不同的可拷贝性或者`in_place_type_t`指定, 执行不同的实现.

### _S_manage

在构造函数中, 我们看到初始化了一个`_M_manager`, 这是一个用来数据访问的接口, 实现如下:

```C++
  template<typename _Tp>
    void
    any::_Manager_external<_Tp>::
    _S_manage(_Op __which, const any* __any, _Arg* __arg)
    {
      // The contained object is *_M_storage._M_ptr
      auto __ptr = static_cast<const _Tp*>(__any->_M_storage._M_ptr);
      switch (__which)
      {
      case _Op_access:
	__arg->_M_obj = const_cast<_Tp*>(__ptr);
	break;
      case _Op_get_type_info:
#if __cpp_rtti
	__arg->_M_typeinfo = &typeid(_Tp);
#endif
	break;
      case _Op_clone:
	__arg->_M_any->_M_storage._M_ptr = new _Tp(*__ptr);
	__arg->_M_any->_M_manager = __any->_M_manager;
	break;
      case _Op_destroy:
	delete __ptr;
	break;
      case _Op_xfer:
	__arg->_M_any->_M_storage._M_ptr = __any->_M_storage._M_ptr;
	__arg->_M_any->_M_manager = __any->_M_manager;
	const_cast<any*>(__any)->_M_manager = nullptr;
	break;
      }
    }
```

`_Arg`是一个联合体, 无需过多关注. 根据不同的需求, `_S_manage`可以执行获取\拷贝\删除等操作. 我们需要关注函数头部的`static_cast<const _Tp*>`, `_Tp`就是`_Manager_external`模板类保存的类型参数, 但是又通过`_S_manage`这个函数指针, 隐藏了这个类型参数. 在`delete`的时候, 因为已经转换为了对应类型, 因此可以执行对应的析构函数.

再关注`__arg->_M_typeinfo = &typeid(_Tp);`, 该方法可以获取参数的运行时类型, 我认为这是`any`类型安全的运行时保证, 有了该方法, 就可以在get的时候做类型判断, 以保证安全.

### 温故知新 type_info

`typeid`怎么实现的? 在前面的文章中, [C++类的内存分布(二)](https://www.bbing.com.cn/202107/cpp-class-mem2)有提到, 类头部再倒退几个byte就是`type_info`结构体, 如下. 但是对于普通类型, 是怎么在运行时获取类型的呢?

!["类的type_info的位置"](https://bu.dusays.com/2022/06/26/62b877fdc28e0.png "类的type_info的位置")

`typeid`可以先参考这篇[C++中typeid实现原理和使用方法](https://hellozhaozheng.github.io/z_post/Cpp-typeid%E8%BF%90%E7%AE%97%E7%AC%A6/), 主要思路是, C++标准没有规定如何实现, 一般情况编译器在编译时就可以确定, 针对多态情况, 就依赖`vtable`头部负偏移的`type_info`结构体.

### any_cast

对于`any`类型, 我们需要通过`any_cast`方法来获取其值, 现在来看看`any_cast`的基本实现, 主要关注`__any_caster`:

```C++
template<typename _Tp>
void* __any_caster(const any* __any)
{
    // any_cast<T> returns non-null if __any->type() == typeid(T) and
    // typeid(T) ignores cv-qualifiers so remove them:
    using _Up = remove_cv_t<_Tp>;
    // The contained value has a decayed type, so if decay_t<U> is not U,
    // then it's not possible to have a contained value of type U:
    if constexpr (!is_same_v<decay_t<_Up>, _Up>)
return nullptr;
    // Only copy constructible types can be used for contained values:
    else if constexpr (!is_copy_constructible_v<_Up>)
return nullptr;
    // First try comparing function addresses, which works without RTTI
    else if (__any->_M_manager == &any::_Manager<_Up>::_S_manage
#if __cpp_rtti
    || __any->type() == typeid(_Tp)
#endif
    )
{
    any::_Arg __arg;
    __any->_M_manager(any::_Op_access, __any, &__arg);
    return __arg._M_obj;
}
    return nullptr;
}
```

首先是移除目标类型的`const`等描述, 然后判断`decay`之后的类型和原来的类型是否相等, 这里意味着不能对目标类型添加过多的修饰, 最好是只使用退化后的类型. 然后再判断可拷贝性等, 最后通过`__any->_M_manager == &any::_Manager<_Up>::_S_manage`判断数据类型是否相等, 如果数据类型相等, 就会匹配同一个模板类, 从而有相同的函数地址, 对于支持RTTI的环境, 也可能通过`type_info`判断类型是否相同.

