<template>
  <div>
    <svg-icon icon-class="question" @click="goto" />
  </div>
</template>

<script>
export default {
  name: 'VctgoDoc',
  data() {
    return {
      url: 'http://doc.huizhidata.com/'
    }
  },
  methods: {
    goto() {
      window.open(this.url)
    }
  }
}
</script>
