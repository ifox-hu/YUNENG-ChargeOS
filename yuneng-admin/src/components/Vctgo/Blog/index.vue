<template>
  <div>
    <svg-icon icon-class="form" @click="goto" />
  </div>
</template>

<script>
export default {
  name: 'VctgoBlog',
  data() {
    return {
      url: 'https://github.com/ifox-hu'
    }
  },
  methods: {
    goto() {
      window.open(this.url)
    }
  }
}
</script>
