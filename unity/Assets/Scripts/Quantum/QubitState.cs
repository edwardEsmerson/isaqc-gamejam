using System;
using System.Numerics;

namespace Quriosity.Quantum
{
    /// <summary>
    /// A normalized pure state alpha|0> + beta|1>. Randomness belongs to the
    /// caller: gates are deterministic, and measurement consumes one sample.
    /// </summary>
    public sealed class QubitState
    {
        private static readonly double inverseSqrtTwo = 1.0 / Math.Sqrt(2.0);
        private Complex zeroAmplitude;
        private Complex oneAmplitude;

        public Complex ZeroAmplitude => zeroAmplitude;
        public Complex OneAmplitude => oneAmplitude;

        public double ZeroProbability
        {
            get
            {
                double zeroWeight = SquaredMagnitude(zeroAmplitude);
                double oneWeight = SquaredMagnitude(oneAmplitude);
                return zeroWeight / (zeroWeight + oneWeight);
            }
        }

        public double OneProbability
        {
            get
            {
                double zeroWeight = SquaredMagnitude(zeroAmplitude);
                double oneWeight = SquaredMagnitude(oneAmplitude);
                return oneWeight / (zeroWeight + oneWeight);
            }
        }

        public QubitState()
        {
            Reset();
        }

        /// <summary>Normalizes finite, nonzero amplitudes without removing their relative phase.</summary>
        public QubitState(Complex zeroAmplitude, Complex oneAmplitude)
        {
            SetNormalized(zeroAmplitude, oneAmplitude);
        }

        public void Reset()
        {
            zeroAmplitude = Complex.One;
            oneAmplitude = Complex.Zero;
        }

        public void ApplyHadamard()
        {
            Complex zero = zeroAmplitude;
            Complex one = oneAmplitude;
            SetNormalized((zero + one) * inverseSqrtTwo, (zero - one) * inverseSqrtTwo);
        }

        public void ApplyX()
        {
            Complex zero = zeroAmplitude;
            zeroAmplitude = oneAmplitude;
            oneAmplitude = zero;
        }

        public void ApplyZ()
        {
            oneAmplitude = -oneAmplitude;
        }

        /// <summary>
        /// Measures in the computational basis using a uniform sample in [0, 1).
        /// The interval [0, P(0)) yields 0; the remainder yields 1. Collapse uses
        /// the canonical basis state, discarding only unobservable global phase.
        /// </summary>
        public int Measure(double unitIntervalSample)
        {
            if (!IsFinite(unitIntervalSample) || unitIntervalSample < 0.0 || unitIntervalSample >= 1.0)
            {
                throw new ArgumentOutOfRangeException(nameof(unitIntervalSample), "Expected a sample in [0, 1).");
            }

            int outcome = unitIntervalSample < ZeroProbability ? 0 : 1;
            zeroAmplitude = outcome == 0 ? Complex.One : Complex.Zero;
            oneAmplitude = outcome == 1 ? Complex.One : Complex.Zero;
            return outcome;
        }

        private void SetNormalized(Complex zero, Complex one)
        {
            if (!IsFinite(zero.Real) || !IsFinite(zero.Imaginary)
                || !IsFinite(one.Real) || !IsFinite(one.Imaginary))
            {
                throw new ArgumentException("Qubit amplitudes must be finite.");
            }

            // Scaling first avoids overflow for large inputs and underflow when
            // both amplitudes are tiny. At least one scaled component has size 1.
            double scale = Math.Max(Math.Max(Math.Abs(zero.Real), Math.Abs(zero.Imaginary)),
                Math.Max(Math.Abs(one.Real), Math.Abs(one.Imaginary)));
            if (scale == 0.0)
            {
                throw new ArgumentException("A qubit cannot have two zero amplitudes.");
            }

            zero = new Complex(zero.Real / scale, zero.Imaginary / scale);
            one = new Complex(one.Real / scale, one.Imaginary / scale);
            double norm = Math.Sqrt(SquaredMagnitude(zero) + SquaredMagnitude(one));
            zeroAmplitude = zero / norm;
            oneAmplitude = one / norm;
        }

        private static double SquaredMagnitude(Complex value)
        {
            return value.Real * value.Real + value.Imaginary * value.Imaginary;
        }

        private static bool IsFinite(double value)
        {
            return !double.IsNaN(value) && !double.IsInfinity(value);
        }
    }
}
