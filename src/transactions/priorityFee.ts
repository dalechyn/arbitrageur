import { GWEI } from '../units'

// this function should calculate the priority fee and bet on PGA if needed
export const getPriorityFee = () => GWEI.mul(3)
