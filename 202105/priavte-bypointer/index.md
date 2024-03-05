# private不保证安全


## 访问private成员

我们知道, C++的priavte关键词可以保证成员的不可见性, 约束了代码维护者之间的一些行为, 但是private并不是安全的, 可以通过指针偏移的方式访问不可见的成员. 如下案例:

<!--more-->

```C++
#include <iostream>

using namespace std;

class A{
public:
    A() {
        cout << "create A" << endl;
    }
    ~A() {
        cout << "delete A" << endl;
    }
    A(const int &size, const float &val) :
    m_size(size),
    m_val(val) {
        cout << "create A " << this << " -> "
             << &m_size << ": " << size << ", "
             << &m_val << ": " << val << endl;
    }

private:
    int m_size;
    float m_val;
};

int main()
{
    A a(1, 3.0);
    void *pb = reinterpret_cast<void *>(&a);

    cout << "private m_size " << *reinterpret_cast<int *>(pb) << endl;
    cout << "private m_val " << *(reinterpret_cast<float *>(pb) + 1) << endl;
}
```

可以得到输出:
```Shell
create A 0x7ffe320d0318 -> 0x7ffe320d0318: 1, 0x7ffe320d031c: 3
private m_size 1
private m_val 3
delete A
```
成功窃取了private的成员内容.

当然通过指针修改private内容也是可以的:
```C++
*reinterpret_cast<int *>(pb) = 10;
cout << "private m_size " << *reinterpret_cast<int *>(pb) << endl;
```
现在输出就是10了.

