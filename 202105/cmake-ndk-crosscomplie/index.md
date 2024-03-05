# cmake链接ndk交叉编译


> 需求: 用CMake构建和编译生成的算法库, 作为动态共享库link到Android项目.

<!--more-->


## 配置

在Android项目的```Android.mk```中添加:
```make
include $(CLEAR_VARS)
LOCAL_PATH          := $(XXXX_PATH)
LOCAL_MODULE        := libxxx
LOCAL_MULTILIB      := 64
LOCAL_SRC_FILES_64  := ./algo/libxxx.so
LOCAL_MODULE_SUFFIX := .so
LOCAL_MODULE_TAGS   := optional
LOCAL_MODULE_CLASS  := SHARED_LIBRARIES
LOCAL_PROPRIETARY_MODULE := true
include $(BUILD_PREBUILT)

include $(CLEAR_VARS)
```

算法库的```CMakeLists.txt```中添加一下编译项和宏:
```make
CMAKE_MINIMUM_REQUIRED(VERSION 3.5)

ADD_DEFINITIONS("-Wall")
ADD_DEFINITIONS("-fPIC")
ADD_DEFINITIONS("-Wl,-lm")
ADD_DEFINITIONS("-Wl,--whole-archive")
SET(CMAKE_CXX_FLAGS "-std=c++17 -pthread -Wall -pie -fPIC -Wl,-Bsymbolic -lz -lc -ldl -lm -D__STDINT_LIMITS -D__STDINT_MACROS -D__ANDROID__ -DANDROID")
SET(EXECUTABLE_OUTPUT_PATH ${PROJECT_SOURCE_DIR})

ADD_EXECUTABLE(xxx xxx.cpp)
```

算法库的```build.sh```编译脚本如下:
```Shell
function build() {
    export ANDROID_NDK=$HOME/android-ndk-r21e
    export PATH=$ANDROID_NDK:$PATH

    rm -r .build
    mkdir .build && cd .build

    cmake -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
        -DANDROID_ABI=arm64-v8a \
        -DANDROID_NDK=$ANDROID_NDK \
        -DANDROID_PLATFORM=latest \
        -DANDROID_LD=lld \
        ..

    make -j12 && make

    cd ..
    rm -r .build/
}
build
```

需要注意的是:

1. 设置环境变量, 添加ndk路径到环境变量
2. cmake配置参数, 按照如上填写
3. ```DANDROID_ABI```要与link库索声明的类型匹配, 比如```Android.mk```中link库声明的是64位, 则这里填写```arm64-v8a```

## 链接
1. [ndk下载](https://developer.android.google.cn/ndk/downloads?hl=zh-cn)
2. [cmake和ndk交叉编译](https://developer.android.google.cn/ndk/guides/cmake)
