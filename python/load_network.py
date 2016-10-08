from keras.models import Sequential
from keras.layers import Dense
from keras.models import load_model
from keras.callbacks import EarlyStopping
import fileinput
import random
import numpy
import json
import sys

# control_flow_ops hack fix
import tensorflow as tf
tf.python.control_flow_ops = tf

# Read in the options, passed as a JSON string in the first argument
options = json.loads(argv[1])

# Get the file path
file_path = options['file_path']

try:
	model = load_model(file_path)
except IOError:
	model = False

if not model:
	print('{"error":"Could not load neural network"}')
else:
	for line in fileinput.input():
		req = json.loads(line);

		result = model.predict(req['input'])

		print(json.dump(result))

		pass