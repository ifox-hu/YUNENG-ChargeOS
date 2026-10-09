<template>
  <div>
    <svg-icon icon-class="github" @click="goto" />
  </div>
</template>

<script>
export default {
  name: 'VctgoGit',
  data() {
    return {
      url: 'https://github.com/roinli/HUIZHI-ChargeOS-cloud'
    }
  },
  methods: {
    goto() {
      window.open(this.url)
    }
  }
}
</script>
