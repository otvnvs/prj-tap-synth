<template>
  <div class="pin-container">
    <h2 class="pin-title">{{ title }}</h2>
    <div class="pin-inputs">
      <input
        v-for="(digit, index) in length"
        :key="index"
        :ref="(el) => (inputRefs[index] = el)"
        v-model="pinValues[index]"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="1"
        class="pin-field"
        @input="handleInput(index, $event)"
        @keydown.delete="handleDelete(index, $event)"
        @paste="handlePaste"
      />
    </div>
    <button 
      :disabled="!isComplete" 
      class="pin-submit" 
      @click="submitPin"
    >
      Submit
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  length: { type: Number, default: 4 },
  title: { type: String, default: 'Enter PIN' }
});

const emit = defineEmits(['submit']);

const pinValues = ref(Array(props.length).fill(''));
const inputRefs = ref([]);

const isComplete = computed(() => {
  return pinValues.value.every(val => val !== '');
});

onMounted(() => {
  if (inputRefs.value[0]) {
    inputRefs.value[0].focus();
  }
});

const handleInput = (index, event) => {
  const val = event.target.value;
  // Allow only numbers
  if (!/^\d*$/.test(val)) {
    pinValues.value[index] = '';
    return;
  }

  if (val && index < props.length - 1) {
    inputRefs.value[index + 1].focus();
  }
};

const handleDelete = (index, event) => {
  if (!pinValues.value[index] && index > 0) {
    pinValues.value[index - 1] = '';
    inputRefs.value[index - 1].focus();
  }
};

const handlePaste = (event) => {
  event.preventDefault();
  const pastedData = event.clipboardData.getData('text').trim();
  if (!/^\d+$/.test(pastedData)) return;

  const digits = pastedData.split('').slice(0, props.length);
  digits.forEach((digit, idx) => {
    pinValues.value[idx] = digit;
  });

  const focusIndex = Math.min(digits.length, props.length - 1);
  inputRefs.value[focusIndex]?.focus();
};

const submitPin = () => {
  if (isComplete.value) {
    emit('submit', pinValues.value.join(''));
  }
};
</script>

<style scoped>
.pin-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: sans-serif;
  padding: 20px;
}
.pin-title {
  margin-bottom: 20px;
  color: #333;
}
.pin-inputs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.pin-field {
  width: 50px;
  height: 50px;
  text-align: center;
  font-size: 24px;
  border: 2px solid #ccc;
  border-radius: 8px;
  outline: none;
}
.pin-field:focus {
  border-color: #42b883;
}
.pin-submit {
  padding: 10px 20px;
  font-size: 16px;
  color: white;
  background-color: #42b883;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.pin-submit:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style>

