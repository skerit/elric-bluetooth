from keras.models import Sequential
from keras.layers import Dense
from keras.models import load_model
from keras.callbacks import EarlyStopping
import random
import numpy
import json

# control_flow_ops hack fix
import tensorflow as tf
tf.python.control_flow_ops = tf

# Fix random seed for reproducibility
# This is important to ensure that the results we achieve from this model can be achieved again precisely
seed = 7
numpy.random.seed(seed)

# Read in the options, passed as a JSON string in the first argument
options = json.loads(argv[1])

# Get the path where the network should be saved to
file_path = options['file_path']

# Get the training data
samples = options['samples']

# Shuffle the samples
shuffled_samples = samples
random.shuffle(shuffled_samples)

# Prepare input/output arrays
input_samples = []
output_samples = []

# Split the input/output samples
for entry in shuffled_samples:
	input_samples.append(entry['input'])
	output_samples.append(entry['output'])

# Try getting the existing model, if allowed
if not options.get('force_new'):
	try:
		model = load_model(file_path)
	except IOError:
		model = False

# If the model doesn't exist yet, create it now
if not model:

	# Create the model
	model = Sequential()

	# Calculate the inputs and neurons
	input_count = options['input_count']
	neuron_count = input_count * 2
	output_count = options['output_count']

	# Input layer has 12 inputs and 24 neurons
	model.add(Dense(neuron_count, input_dim=input_count, init='normal', activation='tanh'))

	# Output layer, has 13 outputs
	model.add(Dense(output_count, init='uniform', activation='sigmoid'))

	# Compile model
	model.compile(loss='categorical_crossentropy',
	              optimizer='adam',
	              metrics=['accuracy'],
	              )

# Create early stopping callback,
# which will stop training once it starts to overfit
early_stopping = EarlyStopping(monitor='val_loss', patience=8)

# Fit (train) the model
model.fit(input_samples,
          output_samples,
          nb_epoch=500,
          batch_size=10,
          # Use 10 percent of the data for validation
          validation_split=0.1,
          callbacks=[early_stopping],
          )

# Save the model
model.save(file_path)