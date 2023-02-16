# Flowbuild Orchestrator
![Coverage lines](./coverage/badge-lines.svg)
![Coverage branches](./coverage/badge-branches.svg)
![Coverage functions](./coverage/badge-functions.svg)
![Coverage statements](./coverage/badge-statements.svg)

Orchestrator for flowbuild environment.

# Run on your localhost:
* Setup:
```
pnpm i
pnpm run prepare
```
* Running:
```
pnpm run start:dev    # will run ts-node
```
or
```
pnpm run build
pnpm run start
```

## Run KAFKA through docker-compose file:
```
docker-compose up --build
```

## App monitoring:
To get application behavior, you might use climem (reference: https://www.npmjs.com/package/climem)

There's a script already set up. Just run:
```
pnpm run start:climem
```

To see memory usage:
```
climem 8998 localhost
```