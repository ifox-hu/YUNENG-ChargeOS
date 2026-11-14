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
      url: 'https://github.com/ifox-hu/YUNENG-ChargeOS/blob/master/docs/development-guide.md'
    }
  },
  methods: {
    goto() {
      window.open(this.url, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>
