using System;
using System.Numerics;
using Quriosity.Quantum;

internal static class Program
{
    private const double Tolerance = 1e-12;
    private static int failures;
    private static int checks;

    private static int Main()
    {
        Run("initial state and reset are |0>", InitialAndReset);
        Run("H prepares equal real amplitudes and Born probabilities", HadamardPreparesSuperposition);
        Run("H twice is identity for arbitrary complex amplitudes", HadamardTwiceIsIdentity);
        Run("X swaps amplitudes and X twice is identity", BitFlip);
        Run("Z preserves probabilities but changes relative phase", PhaseFlip);
        Run("H Z H equals X, including complex amplitudes", InterferenceIsBitFlip);
        Run("relative phase changes H interference, not initial probabilities", RelativePhaseInterference);
        Run("Born probabilities normalize nonunit complex inputs", NormalizedBornProbabilities);
        Run("normalization handles extremely large and small finite inputs", ExtremeNormalization);
        Run("long gate sequences preserve norm and phase", RepeatedGates);
        Run("measurement threshold and both collapse outcomes", MeasurementAndCollapse);
        Run("measurement of each collapsed basis state is stable", StableMeasurement);
        Run("measurement samples follow biased Born weights", BiasedMeasurement);
        Run("external seeded randomness reproduces results", SeededMeasurement);
        Run("invalid amplitudes are rejected", RejectInvalidAmplitudes);
        Run("invalid measurement samples are rejected without mutation", RejectInvalidSamples);

        Console.WriteLine($"Quantum math: {checks - failures}/{checks} checks passed.");
        return failures == 0 ? 0 : 1;
    }

    private static void InitialAndReset()
    {
        var state = new QubitState();
        AssertBasisState(state, 0);
        state.ApplyHadamard();
        state.Measure(0.9);
        state.Reset();
        AssertBasisState(state, 0);
    }

    private static void HadamardPreparesSuperposition()
    {
        var state = new QubitState();
        state.ApplyHadamard();
        double amplitude = 1.0 / Math.Sqrt(2.0);
        AssertComplex(new Complex(amplitude, 0.0), state.ZeroAmplitude);
        AssertComplex(new Complex(amplitude, 0.0), state.OneAmplitude);
        AssertNear(0.5, state.ZeroProbability);
        AssertNear(0.5, state.OneProbability);
    }

    private static void HadamardTwiceIsIdentity()
    {
        foreach (QubitState state in SampleStates())
        {
            Complex zero = state.ZeroAmplitude;
            Complex one = state.OneAmplitude;
            state.ApplyHadamard();
            state.ApplyHadamard();
            AssertComplex(zero, state.ZeroAmplitude);
            AssertComplex(one, state.OneAmplitude);
        }
    }

    private static void BitFlip()
    {
        var basis = new QubitState();
        basis.ApplyX();
        AssertBasisState(basis, 1);
        foreach (QubitState state in SampleStates())
        {
            Complex zero = state.ZeroAmplitude;
            Complex one = state.OneAmplitude;
            double zeroProbability = state.ZeroProbability;
            state.ApplyX();
            AssertComplex(one, state.ZeroAmplitude);
            AssertComplex(zero, state.OneAmplitude);
            AssertNear(zeroProbability, state.OneProbability);
            state.ApplyX();
            AssertComplex(zero, state.ZeroAmplitude);
            AssertComplex(one, state.OneAmplitude);
        }
    }

    private static void PhaseFlip()
    {
        foreach (QubitState state in SampleStates())
        {
            Complex zero = state.ZeroAmplitude;
            Complex one = state.OneAmplitude;
            double probability = state.ZeroProbability;
            state.ApplyZ();
            AssertComplex(zero, state.ZeroAmplitude);
            AssertComplex(-one, state.OneAmplitude);
            AssertNear(probability, state.ZeroProbability);
            state.ApplyZ();
            AssertComplex(one, state.OneAmplitude);
        }
    }

    private static void InterferenceIsBitFlip()
    {
        foreach (QubitState state in SampleStates())
        {
            var expected = new QubitState(state.ZeroAmplitude, state.OneAmplitude);
            expected.ApplyX();
            state.ApplyHadamard();
            state.ApplyZ();
            state.ApplyHadamard();
            AssertComplex(expected.ZeroAmplitude, state.ZeroAmplitude);
            AssertComplex(expected.OneAmplitude, state.OneAmplitude);
        }

        var basis = new QubitState();
        basis.ApplyHadamard();
        basis.ApplyZ();
        basis.ApplyHadamard();
        AssertBasisState(basis, 1);
    }

    private static void RelativePhaseInterference()
    {
        var plus = new QubitState(Complex.One, Complex.One);
        var minus = new QubitState(Complex.One, -Complex.One);
        var quadrature = new QubitState(Complex.One, Complex.ImaginaryOne);
        foreach (QubitState state in new[] { plus, minus, quadrature })
        {
            AssertNear(0.5, state.ZeroProbability);
            AssertNear(0.5, state.OneProbability);
            state.ApplyHadamard();
        }

        AssertBasisState(plus, 0);
        AssertBasisState(minus, 1);
        AssertNear(0.5, quadrature.ZeroProbability);
        AssertComplex(new Complex(0.5, 0.5), quadrature.ZeroAmplitude);
        AssertComplex(new Complex(0.5, -0.5), quadrature.OneAmplitude);

        // A global phase is retained in the amplitudes but is unobservable.
        var globalPhase = new QubitState(Complex.ImaginaryOne, Complex.ImaginaryOne);
        globalPhase.ApplyHadamard();
        AssertComplex(Complex.ImaginaryOne, globalPhase.ZeroAmplitude);
        AssertNear(1.0, globalPhase.ZeroProbability);
    }

    private static void NormalizedBornProbabilities()
    {
        var state = new QubitState(new Complex(3.0, 4.0), new Complex(0.0, 5.0));
        AssertComplex(new Complex(3.0, 4.0) / Math.Sqrt(50.0), state.ZeroAmplitude);
        AssertComplex(new Complex(0.0, 5.0) / Math.Sqrt(50.0), state.OneAmplitude);
        AssertNear(0.5, state.ZeroProbability);
        AssertNear(0.5, state.OneProbability);
        AssertNormalized(state);

        var biased = new QubitState(new Complex(1.0, 2.0), new Complex(3.0, 4.0));
        AssertNear(5.0 / 30.0, biased.ZeroProbability);
        AssertNear(25.0 / 30.0, biased.OneProbability);
        AssertNormalized(biased);
    }

    private static void ExtremeNormalization()
    {
        foreach (double scale in new[] { double.MaxValue, 1e-300, double.Epsilon })
        {
            var state = new QubitState(new Complex(scale, scale), new Complex(-scale, scale));
            AssertComplex(new Complex(0.5, 0.5), state.ZeroAmplitude);
            AssertComplex(new Complex(-0.5, 0.5), state.OneAmplitude);
            AssertNormalized(state);
        }

        var unequal = new QubitState(new Complex(double.MaxValue, 0.0), new Complex(double.Epsilon, 0.0));
        AssertBasisState(unequal, 0);
    }

    private static void RepeatedGates()
    {
        var state = new QubitState(new Complex(2.0, -3.0), new Complex(-5.0, 7.0));
        Complex zero = state.ZeroAmplitude;
        Complex one = state.OneAmplitude;
        for (int i = 0; i < 10000; i++)
        {
            state.ApplyHadamard();
            state.ApplyZ();
            state.ApplyZ();
            state.ApplyHadamard();
            state.ApplyX();
            state.ApplyX();
            AssertNormalized(state);
        }

        AssertComplex(zero, state.ZeroAmplitude);
        AssertComplex(one, state.OneAmplitude);
    }

    private static void MeasurementAndCollapse()
    {
        foreach (double sample in new[] { 0.0, 0.499999999999, 0.5, 0.999999999999 })
        {
            var state = new QubitState();
            state.ApplyHadamard();
            int expected = sample < 0.5 ? 0 : 1;
            AssertEqual(expected, state.Measure(sample));
            AssertBasisState(state, expected);
        }

        var phased = new QubitState(Complex.Zero, Complex.ImaginaryOne);
        AssertEqual(1, phased.Measure(0.0));
        AssertBasisState(phased, 1);
    }

    private static void StableMeasurement()
    {
        foreach (int outcome in new[] { 0, 1 })
        {
            var state = new QubitState();
            state.ApplyHadamard();
            AssertEqual(outcome, state.Measure(outcome == 0 ? 0.1 : 0.9));
            for (int i = 0; i < 1000; i++)
            {
                AssertEqual(outcome, state.Measure(i / 1000.0));
                AssertBasisState(state, outcome);
            }
        }
    }

    private static void BiasedMeasurement()
    {
        int zeroCount = 0;
        for (int i = 0; i < 1000; i++)
        {
            var state = new QubitState(Complex.One, new Complex(Math.Sqrt(3.0), 0.0));
            AssertNear(0.25, state.ZeroProbability);
            int outcome = state.Measure((i + 0.5) / 1000.0);
            zeroCount += outcome == 0 ? 1 : 0;
            AssertBasisState(state, outcome);
        }

        AssertEqual(250, zeroCount);
    }

    private static void SeededMeasurement()
    {
        var firstRandom = new Random(1729);
        var secondRandom = new Random(1729);
        var first = new QubitState();
        var second = new QubitState();
        int zeroCount = 0;
        for (int i = 0; i < 256; i++)
        {
            first.Reset();
            second.Reset();
            first.ApplyHadamard();
            second.ApplyHadamard();
            int outcome = first.Measure(firstRandom.NextDouble());
            AssertEqual(outcome, second.Measure(secondRandom.NextDouble()));
            zeroCount += outcome == 0 ? 1 : 0;
        }

        Assert(zeroCount > 0 && zeroCount < 256, "Seeded sequence should exercise both outcomes.");
    }

    private static void RejectInvalidAmplitudes()
    {
        AssertThrows<ArgumentException>(() => new QubitState(Complex.Zero, Complex.Zero));
        foreach (double invalid in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity })
        {
            AssertThrows<ArgumentException>(() => new QubitState(new Complex(invalid, 0.0), Complex.One));
            AssertThrows<ArgumentException>(() => new QubitState(new Complex(0.0, invalid), Complex.One));
            AssertThrows<ArgumentException>(() => new QubitState(Complex.One, new Complex(invalid, 0.0)));
            AssertThrows<ArgumentException>(() => new QubitState(Complex.One, new Complex(0.0, invalid)));
        }
    }

    private static void RejectInvalidSamples()
    {
        var state = new QubitState(new Complex(1.0, -2.0), new Complex(3.0, 4.0));
        Complex zero = state.ZeroAmplitude;
        Complex one = state.OneAmplitude;
        foreach (double invalid in new[] { -double.Epsilon, -1.0, 1.0, 2.0, double.NaN,
            double.PositiveInfinity, double.NegativeInfinity })
        {
            AssertThrows<ArgumentOutOfRangeException>(() => state.Measure(invalid));
            AssertComplex(zero, state.ZeroAmplitude);
            AssertComplex(one, state.OneAmplitude);
        }
    }

    private static QubitState[] SampleStates()
    {
        return new[]
        {
            new QubitState(),
            new QubitState(Complex.Zero, Complex.One),
            new QubitState(Complex.One, Complex.One),
            new QubitState(Complex.One, -Complex.One),
            new QubitState(Complex.One, Complex.ImaginaryOne),
            new QubitState(new Complex(2.0, -3.0), new Complex(-5.0, 7.0))
        };
    }

    private static void AssertBasisState(QubitState state, int outcome)
    {
        AssertComplex(outcome == 0 ? Complex.One : Complex.Zero, state.ZeroAmplitude);
        AssertComplex(outcome == 1 ? Complex.One : Complex.Zero, state.OneAmplitude);
        AssertNear(outcome == 0 ? 1.0 : 0.0, state.ZeroProbability);
        AssertNear(outcome == 1 ? 1.0 : 0.0, state.OneProbability);
    }

    private static void AssertNormalized(QubitState state)
    {
        double norm = state.ZeroAmplitude.Magnitude * state.ZeroAmplitude.Magnitude
            + state.OneAmplitude.Magnitude * state.OneAmplitude.Magnitude;
        AssertNear(1.0, norm);
        AssertNear(1.0, state.ZeroProbability + state.OneProbability);
        Assert(state.ZeroProbability >= 0.0 && state.ZeroProbability <= 1.0, "P(0) is out of range.");
        Assert(state.OneProbability >= 0.0 && state.OneProbability <= 1.0, "P(1) is out of range.");
    }

    private static void AssertComplex(Complex expected, Complex actual)
    {
        AssertNear(expected.Real, actual.Real);
        AssertNear(expected.Imaginary, actual.Imaginary);
    }

    private static void AssertNear(double expected, double actual)
    {
        Assert(!double.IsNaN(actual) && Math.Abs(expected - actual) <= Tolerance,
            $"Expected {expected:R}, got {actual:R}.");
    }

    private static void AssertEqual(int expected, int actual)
    {
        Assert(expected == actual, $"Expected {expected}, got {actual}.");
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }

    private static void AssertThrows<T>(Action action) where T : Exception
    {
        try
        {
            action();
        }
        catch (T)
        {
            return;
        }

        throw new InvalidOperationException($"Expected {typeof(T).Name}.");
    }

    private static void Run(string name, Action check)
    {
        checks++;
        try
        {
            check();
            Console.WriteLine($"PASS {name}");
        }
        catch (Exception exception)
        {
            failures++;
            Console.Error.WriteLine($"FAIL {name}: {exception.Message}");
        }
    }
}
