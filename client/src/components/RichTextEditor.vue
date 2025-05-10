<template>
  <div class="rich-text-editor">
    <!-- 工具栏容器 -->
    <div ref="toolbar" class="toolbar-container">
      <!-- 通过HTML自定义工具栏 -->
      <select class="ql-header">
        <option value="1"></option>
        <option value="2"></option>
        <option selected></option>
      </select>
      <button class="ql-bold"></button>
      <button class="ql-italic"></button>
      <button class="ql-underline"></button>
      <button class="ql-strike"></button>
      <select class="ql-color"></select>
      <select class="ql-background"></select>
      <button class="ql-link"></button>
      <button class="ql-image"></button>
      <button class="ql-list" value="ordered"></button>
      <button class="ql-list" value="bullet"></button>
      <button class="ql-code-block"></button>
    </div>

    <!-- 编辑器容器 -->
    <div ref="editor" class="editor-container"></div>
  </div>
</template>

<script setup>
  import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
  import Quill from 'quill'
  import 'quill/dist/quill.snow.css'

  const props = defineProps({
    modelValue: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '请输入内容...',
    },
  })

  const emit = defineEmits(['update:modelValue'])

  // DOM引用
  const editor = ref(null)
  const toolbar = ref(null)
  let quill = null

  // 初始化编辑器
  onMounted(() => {
    quill = new Quill(editor.value, {
      modules: {
        toolbar: toolbar.value,
      },
      placeholder: props.placeholder,
      theme: 'snow',
    })

    // 设置初始内容
    if (props.modelValue) {
      quill.root.innerHTML = props.modelValue
    }

    // 监听内容变化
    quill.on('text-change', () => {
      const html = quill.root.innerHTML
      if (html !== '<p><br></p>') {
        emit('update:modelValue', html)
      } else {
        emit('update:modelValue', '')
      }
    })
  })

  // 监听外部数据变化
  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal !== quill.root.innerHTML) {
        quill.root.innerHTML = newVal
      }
    },
  )

  // 清理资源
  onBeforeUnmount(() => {
    if (quill) {
      quill.off('text-change')
    }
  })

  // 暴露方法
  defineExpose({
    getEditor: () => quill,
  })
</script>

<style scoped>
  .rich-text-editor {
    border-radius: 4px;
    border: 1px solid #dcdfe6;
    transition: border-color 0.2s;
  }

  .rich-text-editor:hover {
    border-color: #c0c4cc;
  }

  .toolbar-container {
    border-bottom: 1px solid #dcdfe6;
  }

  .editor-container {
    min-height: 200px;
    max-height: 500px;
    overflow-y: auto;
  }

  /* 适配Element Plus主题 */
  :deep(.ql-toolbar) {
    background-color: #f5f7fa;
    border-radius: 4px 4px 0 0;
  }

  :deep(.ql-container) {
    border-radius: 0 0 4px 4px;
  }

  :deep(.ql-editor) {
    min-height: 200px;
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #606266;
  }

  :deep(.ql-editor.ql-blank::before) {
    color: #c0c4cc;
    font-style: normal;
    left: 15px;
  }
</style>
